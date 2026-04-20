/**
 * ══════════════════════════════════════════════════════════════════════
 *  Predictive Budget Service — Análisis Predictivo de Presupuesto
 * ══════════════════════════════════════════════════════════════════════
 *
 *  PROPÓSITO:
 *    Dado un account de Google Ads, analiza TODO su historial para
 *    predecir cuántas conversiones generará a distintos niveles de
 *    presupuesto, y recomienda el presupuesto óptimo (menor CPA).
 *
 *  FLUJO PRINCIPAL (getPredictiveAnalysis):
 *    1. Query SQL: trae métricas diarias históricas (costo, conversiones,
 *       IS, quality score, presupuesto) + config de conversion_value
 *    2. validateDataQuality() → reporte de calidad de datos
 *    3. buildFeatureMatrix() → transforma en [9 features] por día
 *    4. fitOLS() → entrena regresión: Features → Conversiones
 *    5. Genera 6 escenarios de presupuesto (70%–150% del actual)
 *    6. Busca presupuesto óptimo (50%–200% en pasos de 5%)
 *    7. Descomposición estacional (semanal + mensual)
 *    8. Recomendación final en español
 *
 *  DEPENDENCIAS:
 *    ─ ml-analytics.service.ts → fitOLS, predictWithCI, buildFeatureMatrix,
 *      validateDataQuality, decomposeSeasonality
 *    ─ database (config/database) → query PostgreSQL
 *    ─ Tabla: google_ads_snapshots, campaigns, google_ads_keyword_snapshots,
 *      account_conversion_config
 *
 *  QUIÉN LO USA:
 *    ─ google-ads-analysis.service.ts → getPredictiveAnalysis()
 *    ─ Endpoint: /api/pautadores/analysis/predictive
 * ══════════════════════════════════════════════════════════════════════
 */
import { query } from '../config/database';
import {
  fitOLS,
  predictWithCI,
  fitHoltWinters,
  decomposeSeasonality,
  validateDataQuality,
  buildFeatureMatrix,
  simpleMovingAverageForecast,
  type RegressionResult,
  type PredictionWithCI,
  type DataQualityReport,
  type DailyRow,
} from './ml-analytics.service';

// ────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────

/**
 * Escenario de presupuesto — resultado de simular un nivel de gasto diario.
 * Se genera para cada multiplicador (0.7x, 0.85x, 1.0x, 1.15x, 1.3x, 1.5x).
 */
export interface BudgetScenario {
  /** Presupuesto diario propuesto (USD) */
  dailyBudget: number;
  /** Conversiones diarias predichas por el modelo */
  predictedConversions: number;
  /** CPA esperado = dailyBudget / predictedConversions */
  expectedCPA: number;
  /** Intervalo de confianza al 80% para conversiones */
  ci80: { lower: number; upper: number };
  /** Intervalo de confianza al 95% para conversiones */
  ci95: { lower: number; upper: number };
  /** Proyección mensual (× 30 días) */
  monthlyProjection: {
    monthlyBudget: number;
    monthlyConversions: number;
    monthlyCost: number;
    averageCPA: number;
    /** Solo presente si hay conversion_value configurado en account_conversion_config */
    roi?: number;
  };
}

// ────────────────────────────────────────────────────────────────
//  Service
// ────────────────────────────────────────────────────────────────

export class PredictiveBudgetService {

  /**
   * Extrapola métricas diarias a mensuales (× daysInMonth).
   *
   * Si hay conversion_value configurado (tabla account_conversion_config):
   *   revenue = conversiones_mensuales × conversion_value
   *   profit  = revenue - costo_mensual
   *   ROI     = (profit / costo_mensual) × 100 (%)
   *
   * @param conversionValue - null si no hay configuración de valor por conversión
   */
  projectMonthly(
    dailyBudget: number,
    dailyConversions: number,
    dailyCost: number,
    conversionValue: number | null,
    daysInMonth: number = 30,
  ) {
    const monthlyBudget = dailyBudget * daysInMonth;
    const monthlyConversions = dailyConversions * daysInMonth;
    const monthlyCost = dailyCost * daysInMonth;
    const cpa = monthlyConversions > 0 ? monthlyCost / monthlyConversions : 0;

    const result: any = {
      monthlyBudget: round2(monthlyBudget),
      monthlyConversions: Math.round(monthlyConversions),
      monthlyCost: round2(monthlyCost),
      averageCPA: round2(cpa),
    };

    if (conversionValue !== null && conversionValue > 0) {
      const revenue = monthlyConversions * conversionValue;
      const profit = revenue - monthlyCost;
      result.monthlyRevenue = round2(revenue);
      result.monthlyProfit = round2(profit);
      result.roi = monthlyCost > 0 ? round2((profit / monthlyCost) * 100) : 0;
      result.conversionValueSource = 'configured';
    }

    return result;
  }

  /**
   * Análisis predictivo completo para una cuenta de Google Ads.
   *
   * QUERY SQL (3 CTEs):
   *   1. daily_metrics: agrupa google_ads_snapshots por fecha para la cuenta,
   *      solo campañas ENABLED con cost > 0. Trae TODO el historial (≤ dateTo).
   *      Campos: costo, conversiones, clicks, impressions, presupuesto,
   *      impression_share, budget_lost_is, rank_lost_is, day_of_week, month
   *   2. keyword_quality: promedio de quality_score por fecha desde
   *      google_ads_keyword_snapshots
   *   3. conversion_config: valor por conversión desde account_conversion_config
   *
   * PIPELINE DE ML:
   *   1. Parse de filas → DailyRow[]
   *   2. validateDataQuality() → score 0-100 + warnings
   *   3. buildFeatureMatrix() → matriz X[n×9] + vector Y[n]
   *   4. fitOLS() → regresión: ln(budget) + IS + QS + estacionalidad → conversiones
   *   5. Rendimiento actual: media de últimos 30 días
   *   6. decomposeSeasonality() → patrones semanal y mensual
   *   7. 6 escenarios: [0.7x, 0.85x, 1.0x, 1.15x, 1.3x, 1.5x] del presupuesto actual
   *   8. Búsqueda de óptimo: 50% a 200% en pasos de 5%, minimiza CPA
   *   9. Recomendación en español + warning si R² < 0.6
   */
  async getPredictiveAnalysis(params: {
    accountId: string;
    dateFrom: string;
    dateTo: string;
  }) {
    // Pull ALL historical data for this account
    const sql = `
      WITH daily_metrics AS (
        SELECT
          gs.snapshot_date::text AS snapshot_date,
          SUM(gs.cost)::numeric AS daily_cost,
          SUM(gs.conversions)::numeric AS daily_conversions,
          SUM(gs.clicks)::int AS daily_clicks,
          SUM(gs.impressions)::int AS daily_impressions,
          AVG(COALESCE(gs.daily_budget, c.daily_budget))::numeric AS avg_daily_budget,
          AVG(gs.search_impression_share)::numeric AS avg_impression_share,
          AVG(gs.search_budget_lost_is)::numeric AS avg_budget_lost_is,
          AVG(gs.search_rank_lost_is)::numeric AS avg_rank_lost_is,
          EXTRACT(DOW FROM gs.snapshot_date)::int AS day_of_week,
          EXTRACT(MONTH FROM gs.snapshot_date)::int AS month_of_year
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE c.customer_account_id = $1
          AND c.ads_status = 'ENABLED'
          AND gs.snapshot_date <= $2
        GROUP BY gs.snapshot_date
        ORDER BY gs.snapshot_date
      ),
      keyword_quality AS (
        SELECT
          ks.snapshot_date::text AS snapshot_date,
          AVG(ks.quality_score)::numeric AS avg_quality_score
        FROM google_ads_keyword_snapshots ks
        JOIN campaigns c ON c.id = ks.campaign_id
        WHERE c.customer_account_id = $1
          AND ks.quality_score IS NOT NULL
          AND ks.snapshot_date <= $2
        GROUP BY ks.snapshot_date
      ),
      conversion_config AS (
        SELECT conversion_value
        FROM account_conversion_config
        WHERE customer_account_id = $1
      )
      SELECT
        dm.*,
        kq.avg_quality_score,
        cc.conversion_value
      FROM daily_metrics dm
      LEFT JOIN keyword_quality kq ON kq.snapshot_date = dm.snapshot_date
      LEFT JOIN conversion_config cc ON true
      WHERE dm.daily_cost > 0
      ORDER BY dm.snapshot_date
    `;

    try {
      const result = await query(sql, [params.accountId, params.dateTo]);

      if (result.rows.length === 0) {
        return {
          error: 'Datos insuficientes para prediccion',
          recommendation: 'Se necesitan datos historicos con gasto > 0',
        };
      }

      // Parse rows
      const conversionValue: number | null = result.rows[0].conversion_value
        ? parseFloat(result.rows[0].conversion_value)
        : null;

      const dailyRows: DailyRow[] = result.rows.map((r: any) => ({
        snapshot_date: r.snapshot_date,
        daily_cost: parseFloat(r.daily_cost) || 0,
        daily_conversions: parseFloat(r.daily_conversions) || 0,
        daily_clicks: parseInt(r.daily_clicks) || 0,
        daily_impressions: parseInt(r.daily_impressions) || 0,
        avg_daily_budget: parseFloat(r.avg_daily_budget) || 0,
        avg_impression_share: r.avg_impression_share !== null ? parseFloat(r.avg_impression_share) : null,
        avg_budget_lost_is: r.avg_budget_lost_is !== null ? parseFloat(r.avg_budget_lost_is) : null,
        avg_rank_lost_is: r.avg_rank_lost_is !== null ? parseFloat(r.avg_rank_lost_is) : null,
        avg_quality_score: r.avg_quality_score !== null ? parseFloat(r.avg_quality_score) : null,
        day_of_week: parseInt(r.day_of_week) || 0,
        month_of_year: parseInt(r.month_of_year) || 1,
      }));

      // 1. Data quality validation
      const dataQuality = validateDataQuality(dailyRows);

      // 2. Build feature matrix and fit regression
      const { X, Y, featureNames } = buildFeatureMatrix(dailyRows, 'conversions');
      const regression = fitOLS(X, Y, featureNames);

      if (!regression) {
        return {
          error: 'No fue posible ajustar el modelo de regresion (matriz singular)',
          recommendation: 'Los datos pueden ser demasiado uniformes. Se necesita mas variacion en presupuesto/metricas.',
          dataQuality,
        };
      }

      // 3. Current performance
      const recentDays = dailyRows.slice(-30);
      const currentBudget = mean(recentDays.map(r => r.avg_daily_budget));
      const avgDailyCost = mean(recentDays.map(r => r.daily_cost));
      const avgDailyConversions = mean(recentDays.map(r => r.daily_conversions));
      const avgCPA = avgDailyConversions > 0 ? avgDailyCost / avgDailyConversions : 0;

      // 4. Seasonal decomposition
      const decomposition = decomposeSeasonality(
        dailyRows.map(r => r.daily_conversions),
        dailyRows.map(r => r.snapshot_date),
      );

      // 5. Generate budget scenarios with confidence intervals
      const budgetMultipliers = [0.7, 0.85, 1.0, 1.15, 1.3, 1.5];
      const scenarios: BudgetScenario[] = budgetMultipliers.map(mult => {
        const scenarioBudget = currentBudget * mult;
        const prediction = this.predictForBudget(
          scenarioBudget, regression, recentDays, conversionValue,
        );
        return prediction;
      });

      // 6. Find optimal budget (min CPA with positive conversions)
      let bestScenario = scenarios[2]; // default: current
      let bestCPA = Infinity;
      const step = currentBudget * 0.05;
      for (let budget = currentBudget * 0.5; budget <= currentBudget * 2.0; budget += step) {
        const pred = this.predictForBudget(budget, regression, recentDays, conversionValue);
        if (pred.predictedConversions > 0 && pred.expectedCPA < bestCPA) {
          bestCPA = pred.expectedCPA;
          bestScenario = pred;
        }
      }

      // 7. Build recommendation text
      const budgetDelta = bestScenario.dailyBudget - currentBudget;
      let recommendation: string;
      if (Math.abs(budgetDelta) < currentBudget * 0.05) {
        recommendation = 'Presupuesto actual esta cerca del optimo. Monitorear y ajustar segun condiciones del mercado.';
      } else if (budgetDelta > 0) {
        const pctChange = ((budgetDelta / currentBudget) * 100).toFixed(0);
        recommendation = `Incrementar presupuesto un ${pctChange}% ($${budgetDelta.toFixed(2)}/dia) para mejorar CPA de $${avgCPA.toFixed(2)} a $${bestScenario.expectedCPA.toFixed(2)}`;
      } else {
        const pctChange = ((Math.abs(budgetDelta) / currentBudget) * 100).toFixed(0);
        recommendation = `Reducir presupuesto un ${pctChange}% ($${Math.abs(budgetDelta).toFixed(2)}/dia) para mejorar eficiencia. CPA estimado: $${bestScenario.expectedCPA.toFixed(2)}`;
      }

      // 8. Warn if model quality is low
      const modelWarning = regression.r2 < 0.6
        ? `Calidad del modelo baja (R²=${regression.r2.toFixed(3)}). Las predicciones deben tomarse con precaucion. Se necesitan datos con mayor variacion.`
        : undefined;

      return {
        modelQuality: {
          r2: round3(regression.r2),
          adjustedR2: round3(regression.adjustedR2),
          rmse: round3(regression.rmse),
          equation: regression.equation,
          description: 'Regresion log-lineal multi-variable: ln(Budget) + ImpressionShare + QualityScore + Estacionalidad → Conversiones',
          featureImportance: regression.featureImportance.map(f => ({
            feature: f.feature,
            coefficient: round4(f.coefficient),
            pValue: round4(f.pValue),
            significant: f.significant,
          })),
          nObservations: regression.nObservations,
          dataRange: {
            from: dailyRows[0].snapshot_date,
            to: dailyRows[dailyRows.length - 1].snapshot_date,
          },
          warning: modelWarning,
        },
        currentPerformance: {
          dailyBudget: round2(currentBudget),
          dailyCost: round2(avgDailyCost),
          dailyConversions: round2(avgDailyConversions),
          cpa: round2(avgCPA),
          ...(conversionValue !== null ? {
            roi: avgDailyCost > 0 ? round2(((avgDailyConversions * conversionValue - avgDailyCost) / avgDailyCost) * 100) : 0,
            conversionValueSource: 'configured',
          } : {}),
        },
        optimalRecommendation: {
          ...bestScenario,
          monthlyProjection: this.projectMonthly(
            bestScenario.dailyBudget, bestScenario.predictedConversions,
            bestScenario.dailyBudget, conversionValue,
          ),
          recommendation,
          budgetAdjustment: round2(budgetDelta),
        },
        budgetScenarios: scenarios,
        seasonalPatterns: {
          weeklyEffect: decomposition.seasonalWeekly.map(v => round3(v)),
          monthlyEffect: decomposition.seasonalMonthly.map(v => round3(v)),
          weeklyStrength: round3(decomposition.weeklyStrength),
          monthlyStrength: round3(decomposition.monthlyStrength),
        },
        dataQuality,
        historicalData: {
          dataPoints: dailyRows.length,
          dateRange: {
            from: dailyRows[0].snapshot_date,
            to: dailyRows[dailyRows.length - 1].snapshot_date,
          },
        },
      };
    } catch (err) {
      console.error('Predictive analysis error:', err);
      throw err;
    }
  }

  /**
   * Predice conversiones para un presupuesto hipotético usando el modelo de regresión.
   *
   * Construye un vector de features xNew con 9 valores:
   *   [1, ln(budget+1), medianIS, 1-medianBLIS, medianQS/10, sin_dow=0, cos_dow=1, sin_month=0, cos_month=1]
   *
   * NOTA: sin/cos de día y mes se fijan en 0/1 (punto neutral = promedio).
   * Esto da una predicción "promedio" sin sesgo estacional.
   *
   * Las medianas de IS, BLIS y QS se calculan de los últimos 30 días
   * (recentDays). Si cambias los features en buildFeatureMatrix(),
   * DEBES actualizar este vector también.
   *
   * @param dailyBudget - Presupuesto diario a simular
   * @param regression - Modelo OLS ya ajustado
   * @param recentDays - Últimos 30 días de datos para calcular medianas
   * @param conversionValue - Valor por conversión (null si no configurado)
   */
  private predictForBudget(
    dailyBudget: number,
    regression: RegressionResult,
    recentDays: DailyRow[],
    conversionValue: number | null,
  ): BudgetScenario {
    // Build a feature vector for prediction using recent medians for non-budget features
    const medianIS = sortedMedianFrom(recentDays.map(r => r.avg_impression_share).filter(v => v !== null) as number[]);
    const medianBLIS = sortedMedianFrom(recentDays.map(r => r.avg_budget_lost_is).filter(v => v !== null) as number[]);
    const medianQS = sortedMedianFrom(recentDays.map(r => r.avg_quality_score).filter(v => v !== null) as number[]);

    // Use average day-of-week and month (neutral seasonal point)
    const xNew = [
      1, // intercept
      Math.log(dailyBudget + 1),
      medianIS,
      1 - medianBLIS,
      medianQS / 10,
      0, // sin_dow = 0 (average across week)
      1, // cos_dow = 1 (average across week)
      0, // sin_month = 0 (average across year)
      1, // cos_month = 1 (average across year)
    ];

    const prediction = predictWithCI(regression, xNew);
    const expectedCPA = prediction.predicted > 0 ? dailyBudget / prediction.predicted : 0;

    const monthly = this.projectMonthly(
      dailyBudget, prediction.predicted, dailyBudget, conversionValue,
    );

    return {
      dailyBudget: round2(dailyBudget),
      predictedConversions: round2(prediction.predicted),
      expectedCPA: round2(expectedCPA),
      ci80: { lower: round2(prediction.ci80Lower), upper: round2(prediction.ci80Upper) },
      ci95: { lower: round2(prediction.ci95Lower), upper: round2(prediction.ci95Upper) },
      monthlyProjection: monthly,
    };
  }
}

// ── Helpers ──

/** Redondea a 2 decimales */
function round2(v: number): number { return Math.round(v * 100) / 100; }
/** Redondea a 3 decimales */
function round3(v: number): number { return Math.round(v * 1000) / 1000; }
/** Redondea a 4 decimales */
function round4(v: number): number { return Math.round(v * 10000) / 10000; }

/** Media aritmética. Retorna 0 si array vacío */
function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

/** Mediana de un array (crea copia ordenada). Promedia los 2 centrales si par */
function sortedMedianFrom(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Singleton — se importa como `predictiveBudgetService` en otros servicios */
export const predictiveBudgetService = new PredictiveBudgetService();
