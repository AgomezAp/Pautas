import { query, getClient } from '../config/database';
import { logger } from '../utils/logger.util';
import { websocketService } from './websocket.service';

interface DailyEntryData {
  id: number;
  user_id: number;
  country_id: number;
  campaign_id: number | null;
  clientes: number;
  clientes_efectivos: number;
  menores: number;
  entry_date: string;
  iso_year: number;
  iso_week: number;
}

interface Threshold {
  alert_type: string;
  threshold_value: number;
}

interface AlertPayload {
  alert_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  user_id: number;
  country_id: number;
  campaign_id: number | null;
  daily_entry_id: number | null;
  title: string;
  message: string;
  metadata: Record<string, any>;
}

export class AlertsEngineService {

  // ─── Punto de entrada: evalúa una daily_entry recién creada ──────────

  async evaluateEntry(entry: DailyEntryData): Promise<void> {
    try {
      logger.info(`[ALERTS-ENGINE] Evaluating entry ${entry.id} for user ${entry.user_id}`);

      const thresholds = await this.getThresholds(entry.country_id, entry.campaign_id);
      const historicAvg = await this.getHistoricAverage(entry.user_id, 4);
      const alerts: AlertPayload[] = [];

      // ── CRITICAL: ZERO_EFFECTIVE ──
      if (entry.clientes > 0 && entry.clientes_efectivos === 0) {
        alerts.push({
          alert_type: 'ZERO_EFFECTIVE',
          severity: 'CRITICAL',
          user_id: entry.user_id,
          country_id: entry.country_id,
          campaign_id: entry.campaign_id,
          daily_entry_id: entry.id,
          title: 'Cero clientes efectivos',
          message: `El conglomerado reportó ${entry.clientes} clientes totales pero 0 efectivos.`,
          metadata: { clientes: entry.clientes, clientes_efectivos: 0 },
        });
      }

      // ── CRITICAL: CONVERSION_DROP ──
      if (historicAvg && historicAvg.avg_conversion_rate > 0) {
        const currentRate = entry.clientes > 0
          ? (entry.clientes_efectivos / entry.clientes) * 100
          : 0;
        const threshold = this.getThresholdValue(thresholds, 'CONVERSION_DROP', 30);
        const dropPct = ((historicAvg.avg_conversion_rate - currentRate) / historicAvg.avg_conversion_rate) * 100;

        if (dropPct >= threshold) {
          alerts.push({
            alert_type: 'CONVERSION_DROP',
            severity: 'CRITICAL',
            user_id: entry.user_id,
            country_id: entry.country_id,
            campaign_id: entry.campaign_id,
            daily_entry_id: entry.id,
            title: 'Caída crítica de conversión',
            message: `La tasa de conversión cayó ${dropPct.toFixed(1)}% respecto al promedio histórico (${historicAvg.avg_conversion_rate.toFixed(1)}% → ${currentRate.toFixed(1)}%).`,
            metadata: { current_rate: currentRate, historic_rate: historicAvg.avg_conversion_rate, drop_pct: dropPct },
          });
        }
      }

      // ── WARNING: TRAFFIC_DROP ──
      if (historicAvg && historicAvg.avg_clientes > 0) {
        const threshold = this.getThresholdValue(thresholds, 'TRAFFIC_DROP', 25);
        const dropPct = ((historicAvg.avg_clientes - entry.clientes) / historicAvg.avg_clientes) * 100;

        if (dropPct >= threshold) {
          alerts.push({
            alert_type: 'TRAFFIC_DROP',
            severity: 'WARNING',
            user_id: entry.user_id,
            country_id: entry.country_id,
            campaign_id: entry.campaign_id,
            daily_entry_id: entry.id,
            title: 'Caída de tráfico',
            message: `Los clientes totales bajaron ${dropPct.toFixed(1)}% vs el promedio histórico (${historicAvg.avg_clientes.toFixed(0)} → ${entry.clientes}).`,
            metadata: { current_clientes: entry.clientes, historic_avg: historicAvg.avg_clientes, drop_pct: dropPct },
          });
        }
      }

      // ── WARNING: HIGH_MINORS_RATIO ──
      if (entry.clientes > 0) {
        const minorsRatio = (entry.menores / entry.clientes) * 100;
        const threshold = this.getThresholdValue(thresholds, 'HIGH_MINORS_RATIO', 40);

        if (minorsRatio >= threshold) {
          alerts.push({
            alert_type: 'HIGH_MINORS_RATIO',
            severity: 'WARNING',
            user_id: entry.user_id,
            country_id: entry.country_id,
            campaign_id: entry.campaign_id,
            daily_entry_id: entry.id,
            title: 'Alto ratio de menores',
            message: `El ${minorsRatio.toFixed(1)}% de los clientes son menores (${entry.menores} de ${entry.clientes}).`,
            metadata: { menores: entry.menores, clientes: entry.clientes, ratio: minorsRatio },
          });
        }
      }

      // ── INFO: CONVERSION_SPIKE ──
      if (historicAvg && historicAvg.avg_conversion_rate > 0 && entry.clientes > 0) {
        const currentRate = (entry.clientes_efectivos / entry.clientes) * 100;
        const threshold = this.getThresholdValue(thresholds, 'CONVERSION_SPIKE', 20);
        const spikePct = ((currentRate - historicAvg.avg_conversion_rate) / historicAvg.avg_conversion_rate) * 100;

        if (spikePct >= threshold) {
          alerts.push({
            alert_type: 'CONVERSION_SPIKE',
            severity: 'INFO',
            user_id: entry.user_id,
            country_id: entry.country_id,
            campaign_id: entry.campaign_id,
            daily_entry_id: entry.id,
            title: 'Pico de conversión',
            message: `La tasa de conversión subió ${spikePct.toFixed(1)}% respecto al promedio (${historicAvg.avg_conversion_rate.toFixed(1)}% → ${currentRate.toFixed(1)}%).`,
            metadata: { current_rate: currentRate, historic_rate: historicAvg.avg_conversion_rate, spike_pct: spikePct },
          });
        }
      }

      // ── INFO: RECORD_DAY ──
      const historicMax = await this.getHistoricMaxEfectivos(entry.user_id);
      if (entry.clientes_efectivos > 0 && entry.clientes_efectivos > historicMax) {
        alerts.push({
          alert_type: 'RECORD_DAY',
          severity: 'INFO',
          user_id: entry.user_id,
          country_id: entry.country_id,
          campaign_id: entry.campaign_id,
          daily_entry_id: entry.id,
          title: 'Día récord',
          message: `Nuevo récord de clientes efectivos: ${entry.clientes_efectivos} (anterior: ${historicMax}).`,
          metadata: { current: entry.clientes_efectivos, previous_max: historicMax },
        });
      }

      // ── Guardar todas las alertas generadas ──
      if (alerts.length > 0) {
        await this.saveAlerts(alerts);
        logger.info(`[ALERTS-ENGINE] Generated ${alerts.length} alert(s) for entry ${entry.id}`);
      } else {
        logger.info(`[ALERTS-ENGINE] No alerts generated for entry ${entry.id}`);
      }
    } catch (error: any) {
      logger.error(`[ALERTS-ENGINE] Error evaluating entry ${entry.id}: ${error.message}`);
    }
  }

  // ─── Cron: detectar conglomerados que no reportaron hoy ──────────

  async detectNoReports(): Promise<number> {
    logger.info('[ALERTS-ENGINE] Detecting missing reports...');
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();

    // No verificar fines de semana (sáb=6, dom=0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      logger.info('[ALERTS-ENGINE] Skipping NO_REPORT check (weekend)');
      return 0;
    }

    const result = await query(`
      SELECT u.id AS user_id, u.full_name, u.country_id, u.campaign_id, c.name AS country_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      JOIN countries c ON c.id = u.country_id
      WHERE r.name = 'conglomerado'
        AND u.is_active = TRUE
        AND u.id NOT IN (
          SELECT user_id FROM daily_entries WHERE entry_date = $1
        )
    `, [today]);

    const alerts: AlertPayload[] = result.rows.map((user: any) => ({
      alert_type: 'NO_REPORT',
      severity: 'WARNING' as const,
      user_id: user.user_id,
      country_id: user.country_id,
      campaign_id: user.campaign_id,
      daily_entry_id: null,
      title: 'Sin reporte diario',
      message: `${user.full_name} no envió su reporte del día ${today}.`,
      metadata: { full_name: user.full_name, country: user.country_name, date: today },
    }));

    if (alerts.length > 0) {
      await this.saveAlerts(alerts);
    }

    logger.info(`[ALERTS-ENGINE] ${alerts.length} NO_REPORT alert(s) generated`);
    return alerts.length;
  }

  // ─── Cron: recalcular conglomerate_stats ──────────

  async recomputeStats(): Promise<void> {
    logger.info('[ALERTS-ENGINE] Recomputing conglomerate_stats...');

    // Recalcular las últimas 6 semanas para cada conglomerado activo
    await query(`
      INSERT INTO conglomerate_stats (user_id, iso_year, iso_week, avg_clientes, avg_clientes_efectivos, avg_menores, avg_conversion_rate, total_entries, max_clientes_efectivos)
      SELECT
        de.user_id,
        de.iso_year,
        de.iso_week,
        ROUND(AVG(de.clientes)::numeric, 2),
        ROUND(AVG(de.clientes_efectivos)::numeric, 2),
        ROUND(AVG(de.menores)::numeric, 2),
        CASE WHEN SUM(de.clientes) > 0
          THEN ROUND((SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric) * 100, 4)
          ELSE 0
        END,
        COUNT(de.id)::integer,
        MAX(de.clientes_efectivos)::integer
      FROM daily_entries de
      JOIN users u ON u.id = de.user_id
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'conglomerado'
        AND de.entry_date >= CURRENT_DATE - INTERVAL '42 days'
      GROUP BY de.user_id, de.iso_year, de.iso_week
      ON CONFLICT (user_id, iso_year, iso_week)
      DO UPDATE SET
        avg_clientes = EXCLUDED.avg_clientes,
        avg_clientes_efectivos = EXCLUDED.avg_clientes_efectivos,
        avg_menores = EXCLUDED.avg_menores,
        avg_conversion_rate = EXCLUDED.avg_conversion_rate,
        total_entries = EXCLUDED.total_entries,
        max_clientes_efectivos = EXCLUDED.max_clientes_efectivos,
        computed_at = NOW()
    `);

    logger.info('[ALERTS-ENGINE] conglomerate_stats recomputed');
  }

  // ─── Detección de tendencia con regresión lineal (últimos 14 días) ──

  async detectTrends(): Promise<number> {
    logger.info('[ALERTS-ENGINE] Detecting conversion trends...');

    // Obtener los últimos 14 días de datos por conglomerado activo
    const result = await query(`
      SELECT
        de.user_id,
        u.full_name,
        u.country_id,
        u.campaign_id,
        ARRAY_AGG(
          CASE WHEN de.clientes > 0
            THEN ROUND((de.clientes_efectivos::numeric / de.clientes::numeric) * 100, 2)
            ELSE 0
          END
          ORDER BY de.entry_date
        ) AS rates,
        ARRAY_AGG(de.entry_date ORDER BY de.entry_date) AS dates
      FROM daily_entries de
      JOIN users u ON u.id = de.user_id
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'conglomerado'
        AND u.is_active = TRUE
        AND de.entry_date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY de.user_id, u.full_name, u.country_id, u.campaign_id
      HAVING COUNT(de.id) >= 5
    `);

    let alertCount = 0;

    for (const row of result.rows) {
      const rates: number[] = row.rates.map(Number);
      const slope = this.calculateSlope(rates);

      // Si la pendiente es significativamente negativa
      if (slope < -1.5) {
        // Verificar que no hay ya una alerta TREND_DECLINING activa para este usuario en los últimos 7 días
        const existing = await query(`
          SELECT id FROM alerts
          WHERE alert_type = 'TREND_DECLINING'
            AND user_id = $1
            AND status = 'ACTIVE'
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
          LIMIT 1
        `, [row.user_id]);

        if (existing.rows.length === 0) {
          await this.saveAlerts([{
            alert_type: 'TREND_DECLINING',
            severity: 'WARNING',
            user_id: row.user_id,
            country_id: row.country_id,
            campaign_id: row.campaign_id,
            daily_entry_id: null,
            title: 'Tendencia de conversión a la baja',
            message: `${row.full_name} muestra tendencia negativa en su tasa de conversión (pendiente: ${slope.toFixed(2)}). Últimos 14 días evaluados.`,
            metadata: { slope, rates, dates: row.dates },
          }]);
          alertCount++;
        }
      }
    }

    logger.info(`[ALERTS-ENGINE] ${alertCount} TREND_DECLINING alert(s) generated`);
    return alertCount;
  }

  // ─── Cruce Google Ads vs Datos de Campo ──────────

  async detectAdsDiscrepancy(): Promise<number> {
    logger.info('[ALERTS-ENGINE] Detecting Ads vs Field discrepancies...');

    const result = await query(`
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.country_id,
        co.name AS country_name,
        COALESCE(SUM(gas.conversions), 0) AS ads_conversions,
        COALESCE(SUM(de.clientes_efectivos), 0) AS field_efectivos,
        COALESCE(SUM(gas.cost), 0) AS total_cost
      FROM campaigns c
      JOIN countries co ON co.id = c.country_id
      LEFT JOIN google_ads_snapshots gas ON gas.campaign_id = c.id
        AND gas.snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
      LEFT JOIN daily_entries de ON de.campaign_id = c.id
        AND de.entry_date >= CURRENT_DATE - INTERVAL '7 days'
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.name, c.country_id, co.name
      HAVING COALESCE(SUM(gas.conversions), 0) > 0 OR COALESCE(SUM(de.clientes_efectivos), 0) > 0
    `);

    let alertCount = 0;

    for (const row of result.rows) {
      const adsConv = parseFloat(row.ads_conversions);
      const fieldEfectivos = parseInt(row.field_efectivos);
      const totalCost = parseFloat(row.total_cost);

      if (adsConv === 0 && fieldEfectivos === 0) continue;

      const maxVal = Math.max(adsConv, fieldEfectivos);
      const minVal = Math.min(adsConv, fieldEfectivos);
      const discrepancy = maxVal > 0 ? ((maxVal - minVal) / maxVal) * 100 : 0;

      if (discrepancy >= 50) {
        const costPerReal = fieldEfectivos > 0 ? totalCost / fieldEfectivos : 0;

        // Evitar duplicados recientes
        const existing = await query(`
          SELECT id FROM alerts
          WHERE alert_type = 'ADS_DISCREPANCY'
            AND campaign_id = $1
            AND status = 'ACTIVE'
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
          LIMIT 1
        `, [row.campaign_id]);

        if (existing.rows.length === 0) {
          await this.saveAlerts([{
            alert_type: 'ADS_DISCREPANCY',
            severity: 'WARNING',
            user_id: null as any,
            country_id: row.country_id,
            campaign_id: row.campaign_id,
            daily_entry_id: null,
            title: 'Discrepancia Google Ads vs Campo',
            message: `Campaña "${row.campaign_name}" (${row.country_name}): Google Ads reporta ${adsConv.toFixed(0)} conversiones vs ${fieldEfectivos} clientes efectivos reales. Discrepancia: ${discrepancy.toFixed(1)}%.`,
            metadata: {
              ads_conversions: adsConv,
              field_efectivos: fieldEfectivos,
              discrepancy_pct: discrepancy,
              total_cost: totalCost,
              cost_per_real_client: costPerReal,
            },
          }]);
          alertCount++;
        }
      }
    }

    logger.info(`[ALERTS-ENGINE] ${alertCount} ADS_DISCREPANCY alert(s) generated`);
    return alertCount;
  }

  // ─── Cron: detectar alertas de presupuesto Google Ads ──────────

  async detectBudgetAlerts(): Promise<number> {
    logger.info('[ALERTS-ENGINE] Detecting budget alerts...');

    const result = await query(`
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.country_id,
        co.name AS country_name,
        gas.cost,
        gas.daily_budget,
        gas.snapshot_date
      FROM google_ads_snapshots gas
      JOIN campaigns c ON c.id = gas.campaign_id
      JOIN countries co ON co.id = c.country_id
      WHERE gas.snapshot_date = CURRENT_DATE
        AND gas.daily_budget > 0
    `);

    let alertCount = 0;
    const alerts: AlertPayload[] = [];

    for (const row of result.rows) {
      const cost = parseFloat(row.cost);
      const budget = parseFloat(row.daily_budget);
      const pct = (cost / budget) * 100;

      // BUDGET_OVERSPEND: costo > 110% del presupuesto diario
      if (pct > 110) {
        const existing = await query(`
          SELECT id FROM alerts
          WHERE alert_type = 'BUDGET_OVERSPEND'
            AND campaign_id = $1
            AND status = 'ACTIVE'
            AND created_at::date = CURRENT_DATE
          LIMIT 1
        `, [row.campaign_id]);

        if (existing.rows.length === 0) {
          alerts.push({
            alert_type: 'BUDGET_OVERSPEND',
            severity: 'WARNING',
            user_id: null as any,
            country_id: row.country_id,
            campaign_id: row.campaign_id,
            daily_entry_id: null,
            title: 'Sobregasto de presupuesto',
            message: `Campaña "${row.campaign_name}" (${row.country_name}): gasto $${cost.toFixed(2)} excede el presupuesto diario $${budget.toFixed(2)} (${pct.toFixed(1)}%).`,
            metadata: { cost, daily_budget: budget, pct, campaign_name: row.campaign_name },
          });
          alertCount++;
        }
      }

      // BUDGET_UNDERSPEND: costo < 50% del presupuesto
      if (pct < 50 && cost > 0) {
        const existing = await query(`
          SELECT id FROM alerts
          WHERE alert_type = 'BUDGET_UNDERSPEND'
            AND campaign_id = $1
            AND status = 'ACTIVE'
            AND created_at::date = CURRENT_DATE
          LIMIT 1
        `, [row.campaign_id]);

        if (existing.rows.length === 0) {
          alerts.push({
            alert_type: 'BUDGET_UNDERSPEND',
            severity: 'INFO',
            user_id: null as any,
            country_id: row.country_id,
            campaign_id: row.campaign_id,
            daily_entry_id: null,
            title: 'Subgasto de presupuesto',
            message: `Campaña "${row.campaign_name}" (${row.country_name}): solo se gastó $${cost.toFixed(2)} de $${budget.toFixed(2)} disponibles (${pct.toFixed(1)}%).`,
            metadata: { cost, daily_budget: budget, pct, campaign_name: row.campaign_name },
          });
          alertCount++;
        }
      }
    }

    // BUDGET_EXHAUSTION: proyección mensual agota el presupuesto
    const pacingResult = await query(`
      SELECT
        uga.account_id,
        uga.account_name,
        u.country_id,
        co.name AS country_name,
        SUM(gas.cost) AS accumulated_cost,
        SUM(gas.daily_budget) AS total_daily_budget,
        EXTRACT(DAY FROM CURRENT_DATE) AS day_of_month,
        EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) AS days_in_month
      FROM google_ads_snapshots gas
      JOIN campaigns c ON c.id = gas.campaign_id
      JOIN user_google_ads_accounts uga ON uga.account_id = c.google_ads_account_id
      JOIN users u ON u.id = uga.user_id
      JOIN countries co ON co.id = u.country_id
      WHERE gas.snapshot_date >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY uga.account_id, uga.account_name, u.country_id, co.name
    `);

    for (const row of pacingResult.rows) {
      const accumulated = parseFloat(row.accumulated_cost);
      const dailyBudget = parseFloat(row.total_daily_budget);
      const dayOfMonth = parseInt(row.day_of_month);
      const daysInMonth = parseInt(row.days_in_month);

      if (dailyBudget <= 0 || dayOfMonth <= 1) continue;

      const expectedCost = dailyBudget * dayOfMonth;
      const pacingPct = (accumulated / expectedCost) * 100;

      // Si pacing > 80% se proyecta agotar antes de fin de mes
      if (pacingPct > 130) {
        const existing = await query(`
          SELECT id FROM alerts
          WHERE alert_type = 'BUDGET_EXHAUSTION'
            AND metadata->>'account_id' = $1
            AND status = 'ACTIVE'
            AND created_at >= CURRENT_DATE - INTERVAL '3 days'
          LIMIT 1
        `, [row.account_id]);

        if (existing.rows.length === 0) {
          const projectedMonthly = (accumulated / dayOfMonth) * daysInMonth;
          alerts.push({
            alert_type: 'BUDGET_EXHAUSTION',
            severity: 'WARNING',
            user_id: null as any,
            country_id: row.country_id,
            campaign_id: null,
            daily_entry_id: null,
            title: 'Riesgo de agotamiento de presupuesto',
            message: `Cuenta "${row.account_name}" (${row.country_name}): pacing al ${pacingPct.toFixed(1)}%. Proyección mensual: $${projectedMonthly.toFixed(2)} vs presupuesto esperado: $${(dailyBudget * daysInMonth).toFixed(2)}.`,
            metadata: {
              account_id: row.account_id,
              account_name: row.account_name,
              pacing_pct: pacingPct,
              projected_monthly: projectedMonthly,
              expected_monthly: dailyBudget * daysInMonth,
            },
          });
          alertCount++;
        }
      }
    }

    if (alerts.length > 0) {
      await this.saveAlerts(alerts);
    }

    logger.info(`[ALERTS-ENGINE] ${alertCount} budget alert(s) generated`);
    return alertCount;
  }

  // ─── Cron: detectar anomalías en Google Ads ──────────

  async detectGoogleAdsAnomalies(): Promise<number> {
    logger.info('[ALERTS-ENGINE] Detecting Google Ads anomalies...');
    let alertCount = 0;
    const alerts: AlertPayload[] = [];

    // 1. CPC_SPIKE: CPC incrementó > 30% vs promedio 7 días
    const cpcResult = await query(`
      WITH daily_cpc AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.country_id,
          co.name AS country_name,
          gs.snapshot_date,
          CASE WHEN SUM(gs.clicks) > 0 THEN SUM(gs.cost) / SUM(gs.clicks) ELSE 0 END AS cpc
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        JOIN countries co ON co.id = c.country_id
        WHERE gs.snapshot_date >= CURRENT_DATE - INTERVAL '8 days'
        GROUP BY c.id, c.name, c.country_id, co.name, gs.snapshot_date
      ),
      avg_cpc AS (
        SELECT campaign_id, AVG(cpc) AS avg_cpc, STDDEV_POP(cpc) AS stddev_cpc
        FROM daily_cpc
        WHERE snapshot_date < CURRENT_DATE
        GROUP BY campaign_id
        HAVING COUNT(*) >= 3
      ),
      today_cpc AS (
        SELECT campaign_id, campaign_name, country_id, country_name, cpc
        FROM daily_cpc
        WHERE snapshot_date = CURRENT_DATE AND cpc > 0
      )
      SELECT t.*, a.avg_cpc,
        CASE WHEN a.avg_cpc > 0 THEN ((t.cpc - a.avg_cpc) / a.avg_cpc) * 100 ELSE 0 END AS spike_pct
      FROM today_cpc t
      JOIN avg_cpc a ON a.campaign_id = t.campaign_id
      WHERE a.avg_cpc > 0 AND ((t.cpc - a.avg_cpc) / a.avg_cpc) * 100 > 30
    `);

    for (const row of cpcResult.rows) {
      const existing = await query(`
        SELECT id FROM alerts WHERE alert_type = 'CPC_SPIKE' AND campaign_id = $1 AND status = 'ACTIVE' AND created_at::date = CURRENT_DATE LIMIT 1
      `, [row.campaign_id]);
      if (existing.rows.length === 0) {
        alerts.push({
          alert_type: 'CPC_SPIKE',
          severity: 'WARNING',
          user_id: null as any,
          country_id: row.country_id,
          campaign_id: row.campaign_id,
          daily_entry_id: null,
          title: 'Pico de CPC',
          message: `Campaña "${row.campaign_name}" (${row.country_name}): CPC subió ${parseFloat(row.spike_pct).toFixed(1)}% vs promedio 7 días ($${parseFloat(row.avg_cpc).toFixed(2)} → $${parseFloat(row.cpc).toFixed(2)}).`,
          metadata: { cpc: parseFloat(row.cpc), avg_cpc: parseFloat(row.avg_cpc), spike_pct: parseFloat(row.spike_pct) },
        });
        alertCount++;
      }
    }

    // 2. CTR_ANOMALY: CTR desvió > 2 desviaciones estándar
    const ctrResult = await query(`
      WITH daily_ctr AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.country_id,
          co.name AS country_name,
          gs.snapshot_date,
          CASE WHEN SUM(gs.impressions) > 0 THEN (SUM(gs.clicks)::numeric / SUM(gs.impressions)::numeric) * 100 ELSE 0 END AS ctr
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        JOIN countries co ON co.id = c.country_id
        WHERE gs.snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY c.id, c.name, c.country_id, co.name, gs.snapshot_date
      ),
      stats AS (
        SELECT campaign_id, AVG(ctr) AS avg_ctr, STDDEV_POP(ctr) AS stddev_ctr
        FROM daily_ctr WHERE snapshot_date < CURRENT_DATE
        GROUP BY campaign_id HAVING COUNT(*) >= 5 AND STDDEV_POP(ctr) > 0
      ),
      today AS (
        SELECT campaign_id, campaign_name, country_id, country_name, ctr
        FROM daily_ctr WHERE snapshot_date = CURRENT_DATE
      )
      SELECT t.*, s.avg_ctr, s.stddev_ctr,
        ABS(t.ctr - s.avg_ctr) / s.stddev_ctr AS z_score
      FROM today t
      JOIN stats s ON s.campaign_id = t.campaign_id
      WHERE ABS(t.ctr - s.avg_ctr) / s.stddev_ctr > 2
    `);

    for (const row of ctrResult.rows) {
      const existing = await query(`
        SELECT id FROM alerts WHERE alert_type = 'CTR_ANOMALY' AND campaign_id = $1 AND status = 'ACTIVE' AND created_at::date = CURRENT_DATE LIMIT 1
      `, [row.campaign_id]);
      if (existing.rows.length === 0) {
        const direction = parseFloat(row.ctr) > parseFloat(row.avg_ctr) ? 'subió' : 'bajó';
        alerts.push({
          alert_type: 'CTR_ANOMALY',
          severity: 'WARNING',
          user_id: null as any,
          country_id: row.country_id,
          campaign_id: row.campaign_id,
          daily_entry_id: null,
          title: 'Anomalía de CTR',
          message: `Campaña "${row.campaign_name}" (${row.country_name}): CTR ${direction} a ${parseFloat(row.ctr).toFixed(2)}% (promedio: ${parseFloat(row.avg_ctr).toFixed(2)}%, z-score: ${parseFloat(row.z_score).toFixed(1)}).`,
          metadata: { ctr: parseFloat(row.ctr), avg_ctr: parseFloat(row.avg_ctr), z_score: parseFloat(row.z_score) },
        });
        alertCount++;
      }
    }

    // 3. IMPRESSION_SHARE_DROP: IS cayó > 20% vs semana anterior
    const isResult = await query(`
      WITH weekly_is AS (
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          c.country_id,
          co.name AS country_name,
          CASE WHEN gs.snapshot_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'current' ELSE 'previous' END AS period,
          AVG(gs.search_impression_share) AS avg_is
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        JOIN countries co ON co.id = c.country_id
        WHERE gs.snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
          AND gs.search_impression_share IS NOT NULL
          AND gs.search_impression_share > 0
        GROUP BY c.id, c.name, c.country_id, co.name,
          CASE WHEN gs.snapshot_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'current' ELSE 'previous' END
      )
      SELECT
        cur.campaign_id, cur.campaign_name, cur.country_id, cur.country_name,
        cur.avg_is AS current_is, prev.avg_is AS previous_is,
        ((prev.avg_is - cur.avg_is) / prev.avg_is) * 100 AS drop_pct
      FROM weekly_is cur
      JOIN weekly_is prev ON prev.campaign_id = cur.campaign_id AND prev.period = 'previous'
      WHERE cur.period = 'current'
        AND prev.avg_is > 0
        AND ((prev.avg_is - cur.avg_is) / prev.avg_is) * 100 > 20
    `);

    for (const row of isResult.rows) {
      const existing = await query(`
        SELECT id FROM alerts WHERE alert_type = 'IMPRESSION_SHARE_DROP' AND campaign_id = $1 AND status = 'ACTIVE' AND created_at >= CURRENT_DATE - INTERVAL '7 days' LIMIT 1
      `, [row.campaign_id]);
      if (existing.rows.length === 0) {
        alerts.push({
          alert_type: 'IMPRESSION_SHARE_DROP',
          severity: 'WARNING',
          user_id: null as any,
          country_id: row.country_id,
          campaign_id: row.campaign_id,
          daily_entry_id: null,
          title: 'Caída de Impression Share',
          message: `Campaña "${row.campaign_name}" (${row.country_name}): IS cayó ${parseFloat(row.drop_pct).toFixed(1)}% vs semana anterior (${parseFloat(row.previous_is).toFixed(1)}% → ${parseFloat(row.current_is).toFixed(1)}%).`,
          metadata: { current_is: parseFloat(row.current_is), previous_is: parseFloat(row.previous_is), drop_pct: parseFloat(row.drop_pct) },
        });
        alertCount++;
      }
    }

    // 4. KEYWORD_QS_DROP: QS promedio cayó > 1 punto
    const qsResult = await query(`
      WITH weekly_qs AS (
        SELECT
          c.google_ads_account_id AS account_id,
          uga.account_name,
          u.country_id,
          co.name AS country_name,
          CASE WHEN ks.snapshot_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'current' ELSE 'previous' END AS period,
          AVG(ks.quality_score) AS avg_qs
        FROM google_ads_keyword_snapshots ks
        JOIN campaigns c ON c.id = ks.campaign_id
        LEFT JOIN user_google_ads_accounts uga ON uga.account_id = c.google_ads_account_id
        LEFT JOIN users u ON u.id = uga.user_id
        LEFT JOIN countries co ON co.id = u.country_id
        WHERE ks.snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
          AND ks.quality_score IS NOT NULL AND ks.quality_score > 0
        GROUP BY c.google_ads_account_id, uga.account_name, u.country_id, co.name,
          CASE WHEN ks.snapshot_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'current' ELSE 'previous' END
      )
      SELECT
        cur.account_id, cur.account_name, cur.country_id, cur.country_name,
        cur.avg_qs AS current_qs, prev.avg_qs AS previous_qs,
        prev.avg_qs - cur.avg_qs AS qs_drop
      FROM weekly_qs cur
      JOIN weekly_qs prev ON prev.account_id = cur.account_id AND prev.period = 'previous'
      WHERE cur.period = 'current' AND prev.avg_qs - cur.avg_qs > 1
    `);

    for (const row of qsResult.rows) {
      const existing = await query(`
        SELECT id FROM alerts WHERE alert_type = 'KEYWORD_QS_DROP' AND metadata->>'account_id' = $1 AND status = 'ACTIVE' AND created_at >= CURRENT_DATE - INTERVAL '7 days' LIMIT 1
      `, [row.account_id]);
      if (existing.rows.length === 0) {
        alerts.push({
          alert_type: 'KEYWORD_QS_DROP',
          severity: 'WARNING',
          user_id: null as any,
          country_id: row.country_id,
          campaign_id: null,
          daily_entry_id: null,
          title: 'Caída de Quality Score',
          message: `Cuenta "${row.account_name}" (${row.country_name}): QS promedio cayó ${parseFloat(row.qs_drop).toFixed(1)} puntos (${parseFloat(row.previous_qs).toFixed(1)} → ${parseFloat(row.current_qs).toFixed(1)}).`,
          metadata: { account_id: row.account_id, current_qs: parseFloat(row.current_qs), previous_qs: parseFloat(row.previous_qs), qs_drop: parseFloat(row.qs_drop) },
        });
        alertCount++;
      }
    }

    // 5. OPPORTUNITY_ALERT: Alto budget_lost_IS (> 30%) con buena conversión
    const oppResult = await query(`
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.country_id,
        co.name AS country_name,
        AVG(gs.search_budget_lost_is) AS avg_budget_lost_is,
        SUM(gs.conversions) AS total_conversions,
        SUM(gs.cost) AS total_cost,
        CASE WHEN SUM(gs.conversions) > 0 THEN SUM(gs.cost) / SUM(gs.conversions) ELSE 0 END AS cpa
      FROM google_ads_snapshots gs
      JOIN campaigns c ON c.id = gs.campaign_id
      JOIN countries co ON co.id = c.country_id
      WHERE gs.snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
        AND gs.search_budget_lost_is IS NOT NULL
      GROUP BY c.id, c.name, c.country_id, co.name
      HAVING AVG(gs.search_budget_lost_is) > 30 AND SUM(gs.conversions) > 0
    `);

    for (const row of oppResult.rows) {
      const existing = await query(`
        SELECT id FROM alerts WHERE alert_type = 'OPPORTUNITY_ALERT' AND campaign_id = $1 AND status = 'ACTIVE' AND created_at >= CURRENT_DATE - INTERVAL '7 days' LIMIT 1
      `, [row.campaign_id]);
      if (existing.rows.length === 0) {
        alerts.push({
          alert_type: 'OPPORTUNITY_ALERT',
          severity: 'INFO',
          user_id: null as any,
          country_id: row.country_id,
          campaign_id: row.campaign_id,
          daily_entry_id: null,
          title: 'Oportunidad de crecimiento',
          message: `Campaña "${row.campaign_name}" (${row.country_name}): pierde ${parseFloat(row.avg_budget_lost_is).toFixed(1)}% IS por presupuesto pero tiene CPA $${parseFloat(row.cpa).toFixed(2)}. Incrementar presupuesto podría generar más conversiones.`,
          metadata: { budget_lost_is: parseFloat(row.avg_budget_lost_is), cpa: parseFloat(row.cpa), conversions: parseFloat(row.total_conversions) },
        });
        alertCount++;
      }
    }

    if (alerts.length > 0) {
      await this.saveAlerts(alerts);
    }

    logger.info(`[ALERTS-ENGINE] ${alertCount} anomaly alert(s) generated`);
    return alertCount;
  }

  // ─── Obtener resumen del día para email ──────────

  async getDailySummary(): Promise<{
    alerts: any[];
    consolidated: { total_entries: number; total_clientes: number; total_efectivos: number };
    noReportUsers: any[];
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [alertsResult, consolidatedResult, noReportResult] = await Promise.all([
      query(`
        SELECT a.*, u.full_name, c.name AS country_name
        FROM alerts a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN countries c ON c.id = a.country_id
        WHERE a.created_at::date = $1
        ORDER BY
          CASE a.severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
          a.created_at DESC
      `, [today]),
      query(`
        SELECT
          COUNT(*) AS total_entries,
          COALESCE(SUM(clientes), 0) AS total_clientes,
          COALESCE(SUM(clientes_efectivos), 0) AS total_efectivos
        FROM daily_entries
        WHERE entry_date = $1
      `, [today]),
      query(`
        SELECT u.full_name, u.email, c.name AS country_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN countries c ON c.id = u.country_id
        WHERE r.name = 'conglomerado' AND u.is_active = TRUE
          AND u.id NOT IN (SELECT user_id FROM daily_entries WHERE entry_date = $1)
      `, [today]),
    ]);

    return {
      alerts: alertsResult.rows,
      consolidated: consolidatedResult.rows[0],
      noReportUsers: noReportResult.rows,
    };
  }

  // ─── Obtener emails de pautadores para notificación ──────────

  async getPautadorEmails(): Promise<string[]> {
    const result = await query(`
      SELECT DISTINCT u.email
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('pautador', 'admin')
        AND u.is_active = TRUE
        AND u.email IS NOT NULL
        AND u.email != ''
    `);
    return result.rows.map((r: any) => r.email);
  }

  // ─── Helpers privados ──────────────────────────────────────────

  private async getThresholds(countryId: number, campaignId: number | null): Promise<Threshold[]> {
    // Buscar umbrales: primero específicos (país+campaña), luego por país, luego globales
    const result = await query(`
      SELECT alert_type, threshold_value
      FROM alert_thresholds
      WHERE is_active = TRUE
        AND (
          (country_id = $1 AND campaign_id = $2) OR
          (country_id = $1 AND campaign_id IS NULL) OR
          (country_id IS NULL AND campaign_id IS NULL)
        )
      ORDER BY
        country_id NULLS LAST,
        campaign_id NULLS LAST
    `, [countryId, campaignId]);

    // Deduplicar: el más específico gana
    const map = new Map<string, number>();
    for (const row of result.rows) {
      if (!map.has(row.alert_type)) {
        map.set(row.alert_type, parseFloat(row.threshold_value));
      }
    }

    return Array.from(map.entries()).map(([alert_type, threshold_value]) => ({
      alert_type,
      threshold_value,
    }));
  }

  private getThresholdValue(thresholds: Threshold[], alertType: string, defaultVal: number): number {
    const t = thresholds.find(th => th.alert_type === alertType);
    return t ? t.threshold_value : defaultVal;
  }

  private async getHistoricAverage(userId: number, weeks: number) {
    const result = await query(`
      SELECT
        AVG(clientes)::numeric AS avg_clientes,
        AVG(clientes_efectivos)::numeric AS avg_clientes_efectivos,
        AVG(menores)::numeric AS avg_menores,
        CASE WHEN SUM(clientes) > 0
          THEN (SUM(clientes_efectivos)::numeric / SUM(clientes)::numeric) * 100
          ELSE 0
        END AS avg_conversion_rate,
        COUNT(*) AS total_entries
      FROM daily_entries
      WHERE user_id = $1
        AND entry_date >= CURRENT_DATE - ($2 * 7 || ' days')::interval
        AND entry_date < CURRENT_DATE
    `, [userId, weeks]);

    if (result.rows.length === 0 || parseInt(result.rows[0].total_entries) < 3) {
      return null;
    }

    return {
      avg_clientes: parseFloat(result.rows[0].avg_clientes),
      avg_clientes_efectivos: parseFloat(result.rows[0].avg_clientes_efectivos),
      avg_menores: parseFloat(result.rows[0].avg_menores),
      avg_conversion_rate: parseFloat(result.rows[0].avg_conversion_rate),
      total_entries: parseInt(result.rows[0].total_entries),
    };
  }

  private async getHistoricMaxEfectivos(userId: number): Promise<number> {
    const result = await query(
      `SELECT COALESCE(MAX(clientes_efectivos), 0) AS max_val
       FROM daily_entries
       WHERE user_id = $1 AND entry_date < CURRENT_DATE`,
      [userId]
    );
    return parseInt(result.rows[0].max_val) || 0;
  }

  private async saveAlerts(alerts: AlertPayload[]): Promise<void> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      for (const alert of alerts) {
        await client.query(`
          INSERT INTO alerts (alert_type, severity, user_id, country_id, campaign_id, daily_entry_id, title, message, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          alert.alert_type, alert.severity, alert.user_id, alert.country_id,
          alert.campaign_id, alert.daily_entry_id, alert.title, alert.message,
          JSON.stringify(alert.metadata),
        ]);
      }
      await client.query('COMMIT');

      // Broadcast new alerts via WebSocket
      for (const alert of alerts) {
        websocketService.broadcastAlert({
          alert_type: alert.alert_type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata,
          created_at: new Date().toISOString(),
        }, alert.user_id);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Regresión lineal simple: calcula la pendiente
  private calculateSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
  }
}

export const alertsEngineService = new AlertsEngineService();
