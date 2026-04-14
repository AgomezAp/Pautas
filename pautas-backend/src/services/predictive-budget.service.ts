import { query } from '../config/database';

interface BudgetPoint {
  dailyBudget: number;
  conversions: number;
  cost: number;
  clicks: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

interface PredictionResult {
  dailyBudget: number;
  predictedConversions: number;
  predictedCost: number;
  expectedCPA: number;
  roi: number;
}

/**
 * Predictive Budget Service
 * Uses linear regression to:
 * 1. Predict conversions based on budget
 * 2. Find optimal budget for maximum ROI
 * 3. Project monthly outcomes
 */
export class PredictiveBudgetService {
  /**
   * Calculate linear regression: budget -> conversions
   * Returns: conversions = intercept + slope * budget
   */
  private calculateRegression(dataPoints: BudgetPoint[]): RegressionResult {
    if (dataPoints.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (const point of dataPoints) {
      const x = point.dailyBudget;
      const y = point.conversions;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² (coefficient of determination)
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    for (const point of dataPoints) {
      const predicted = intercept + slope * point.dailyBudget;
      ssTotal += Math.pow(point.conversions - yMean, 2);
      ssResidual += Math.pow(point.conversions - predicted, 2);
    }

    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { slope, intercept, r2 };
  }

  /**
   * Predict conversions for a given daily budget
   */
  predictConversions(
    dailyBudget: number,
    regression: RegressionResult,
    avgCPA: number
  ): PredictionResult {
    const predictedConversions = Math.max(
      0,
      regression.intercept + regression.slope * dailyBudget
    );
    const predictedCost = dailyBudget;
    const expectedCPA = predictedConversions > 0
      ? predictedCost / predictedConversions
      : avgCPA;

    // Assume $50 value per conversion (configurable)
    const conversionValue = 50;
    const revenue = predictedConversions * conversionValue;
    const roi = predictedCost > 0 ? ((revenue - predictedCost) / predictedCost) * 100 : 0;

    return {
      dailyBudget,
      predictedConversions: Math.round(predictedConversions * 100) / 100,
      predictedCost,
      expectedCPA: Math.round(expectedCPA * 100) / 100,
      roi: Math.round(roi * 100) / 100,
    };
  }

  /**
   * Find optimal budget that maximizes ROI
   */
  findOptimalBudget(
    regression: RegressionResult,
    avgCPA: number,
    currentBudget: number,
    maxBudget: number
  ): PredictionResult {
    const conversionValue = 50; // Configurable
    const step = currentBudget * 0.1; // Test 10% increments
    let bestBudget = currentBudget;
    let bestROI = -Infinity;

    // Test different budget levels
    for (let budget = currentBudget * 0.5; budget <= maxBudget * 1.5; budget += step) {
      const prediction = this.predictConversions(budget, regression, avgCPA);
      if (prediction.roi > bestROI) {
        bestROI = prediction.roi;
        bestBudget = budget;
      }
    }

    return this.predictConversions(bestBudget, regression, avgCPA);
  }

  /**
   * Project monthly outcomes based on daily metrics
   */
  projectMonthly(
    dailyBudget: number,
    dailyConversions: number,
    dailyCost: number,
    daysInMonth: number = 30
  ) {
    const monthlyBudget = dailyBudget * daysInMonth;
    const monthlyConversions = dailyConversions * daysInMonth;
    const monthlyCost = dailyCost * daysInMonth;
    const cpa = monthlyConversions > 0 ? monthlyCost / monthlyConversions : 0;

    const conversionValue = 50;
    const revenue = monthlyConversions * conversionValue;
    const profit = revenue - monthlyCost;
    const roi = monthlyCost > 0 ? (profit / monthlyCost) * 100 : 0;

    return {
      monthlyBudget: Math.round(monthlyBudget * 100) / 100,
      monthlyConversions: Math.round(monthlyConversions),
      monthlyCost: Math.round(monthlyCost * 100) / 100,
      monthlyRevenue: Math.round(revenue * 100) / 100,
      monthlyProfit: Math.round(profit * 100) / 100,
      averageCPA: Math.round(cpa * 100) / 100,
      roi: Math.round(roi * 100) / 100,
    };
  }

  /**
   * Get predictive budget analysis for an account
   * Fetches historical data and generates predictions
   */
  async getPredictiveAnalysis(params: {
    accountId: string;
    dateFrom: string;
    dateTo: string;
    daysOfHistoryForRegression?: number;
  }) {
    const historyDays = params.daysOfHistoryForRegression || 30;
    const conversionValue = 50;

    // Calculate date ranges
    const toDate = new Date(params.dateTo);
    const fromDate = new Date(params.dateFrom);
    const historyFromDate = new Date(toDate);
    historyFromDate.setDate(historyFromDate.getDate() - historyDays);

    const sql = `
      WITH daily_budget_performance AS (
        SELECT
          gs.snapshot_date,
          c.customer_account_id,
          COALESCE(c.daily_budget, 0) AS daily_budget,
          SUM(gs.cost) AS daily_cost,
          SUM(gs.conversions) AS daily_conversions,
          SUM(gs.clicks) AS daily_clicks,
          CASE WHEN SUM(gs.conversions) > 0
            THEN ROUND(SUM(gs.cost) / SUM(gs.conversions), 2)
            ELSE 0
          END AS daily_cpa
        FROM google_ads_snapshots gs
        JOIN campaigns c ON c.id = gs.campaign_id
        WHERE c.customer_account_id = $1
          AND gs.snapshot_date BETWEEN $2 AND $3
        GROUP BY gs.snapshot_date, c.customer_account_id, c.daily_budget
      ),
      aggregated_metrics AS (
        SELECT
          daily_budget,
          SUM(daily_cost) AS total_cost,
          SUM(daily_conversions) AS total_conversions,
          SUM(daily_clicks) AS total_clicks,
          COUNT(*) AS days_count,
          ROUND(AVG(daily_cpa), 2) AS avg_cpa,
          ROUND(SUM(daily_cost) / NULLIF(SUM(daily_conversions), 0), 2) AS overall_cpa
        FROM daily_budget_performance
        GROUP BY daily_budget
        HAVING SUM(daily_cost) > 0
      ),
      current_metrics AS (
        SELECT
          COALESCE(AVG(total_cost), 0) AS avg_daily_cost,
          COALESCE(SUM(total_conversions) / NULLIF(SUM(days_count), 0), 0) AS avg_daily_conversions,
          COALESCE(AVG(overall_cpa), 0) AS overall_cpa,
          MAX(daily_budget) AS current_budget
        FROM aggregated_metrics
      )
      SELECT
        am.*,
        cm.avg_daily_cost,
        cm.avg_daily_conversions,
        cm.overall_cpa,
        cm.current_budget
      FROM aggregated_metrics am
      CROSS JOIN current_metrics cm
      ORDER BY am.daily_budget ASC
    `;

    try {
      const result = await query(sql, [params.accountId, historyFromDate.toISOString().split('T')[0], params.dateTo]);

      if (result.rows.length === 0) {
        return {
          error: 'Insufficient data for prediction',
          recommendation: 'Need at least 7 days of data with varying budgets',
        };
      }

      // Convert to regression data points
      const dataPoints: BudgetPoint[] = result.rows.map((row: any) => ({
        dailyBudget: parseFloat(row.daily_budget) || 0,
        conversions: parseFloat(row.total_conversions) || 0,
        cost: parseFloat(row.total_cost) || 0,
        clicks: parseFloat(row.total_clicks) || 0,
      }));

      // Calculate regression
      const regression = this.calculateRegression(dataPoints);

      if (regression.r2 < 0.3) {
        return {
          error: 'Low model confidence (R² < 0.3)',
          recommendation: 'Insufficient correlation between budget and conversions. Need more varied budget levels.',
          rSquared: regression.r2,
        };
      }

      const currentBudget = result.rows[result.rows.length - 1].current_budget || 100;
      const avgCPA = result.rows[0].overall_cpa || 0;
      const currentMetrics = result.rows[0];

      // Get optimal prediction
      const optimal = this.findOptimalBudget(
        regression,
        avgCPA,
        currentBudget,
        currentBudget * 3 // Max 3x current budget for recommendations
      );

      // Generate budget scenarios
      const scenarios = [
        this.predictConversions(currentBudget * 0.7, regression, avgCPA),
        this.predictConversions(currentBudget * 0.9, regression, avgCPA),
        this.predictConversions(currentBudget, regression, avgCPA),
        this.predictConversions(currentBudget * 1.1, regression, avgCPA),
        this.predictConversions(currentBudget * 1.3, regression, avgCPA),
        this.predictConversions(currentBudget * 1.5, regression, avgCPA),
      ];

      // Monthly projections
      const currentMonthly = this.projectMonthly(
        currentBudget,
        currentMetrics.avg_daily_conversions,
        currentMetrics.avg_daily_cost
      );

      const optimalMonthly = this.projectMonthly(
        optimal.dailyBudget,
        optimal.predictedConversions,
        optimal.predictedCost
      );

      // Recommendation
      let recommendation = '';
      const budgetDelta = optimal.dailyBudget - currentBudget;
      const roiDelta = optimal.roi - scenarios[2].roi;

      if (budgetDelta > 0) {
        recommendation = `Increase budget by $${budgetDelta.toFixed(2)}/day to maximize ROI (+${roiDelta.toFixed(1)}%)`;
      } else if (budgetDelta < 0) {
        recommendation = `Reduce budget by $${Math.abs(budgetDelta).toFixed(2)}/day to improve efficiency (+${roiDelta.toFixed(1)}% ROI)`;
      } else {
        recommendation = 'Current budget is near optimal. Monitor and adjust based on market conditions.';
      }

      return {
        modelQuality: {
          r2: Math.round(regression.r2 * 1000) / 1000,
          slope: Math.round(regression.slope * 1000) / 1000,
          intercept: Math.round(regression.intercept * 1000) / 1000,
          equation: `Conversions = ${regression.intercept.toFixed(2)} + ${regression.slope.toFixed(4)} × Budget`,
          description: 'Linear regression model: Daily Budget → Daily Conversions',
        },
        currentPerformance: {
          dailyBudget: currentBudget,
          dailyCost: currentMetrics.avg_daily_cost,
          dailyConversions: currentMetrics.avg_daily_conversions,
          cpa: currentMetrics.overall_cpa,
          roi: scenarios[2].roi,
        },
        optimalRecommendation: {
          ...optimal,
          monthlyProjection: optimalMonthly,
          recommendation,
          budgetAdjustment: budgetDelta,
          expectedROIImprovement: roiDelta,
        },
        budgetScenarios: scenarios.map(s => ({
          ...s,
          monthlyProjection: this.projectMonthly(s.dailyBudget, s.predictedConversions, s.predictedCost),
        })),
        historicalData: {
          dataPoints: dataPoints.length,
          dateRange: {
            from: historyFromDate.toISOString().split('T')[0],
            to: params.dateTo,
          },
          averageDailyMetrics: currentMetrics,
        },
      };
    } catch (err) {
      console.error('Predictive analysis error:', err);
      throw err;
    }
  }
}

export const predictiveBudgetService = new PredictiveBudgetService();
