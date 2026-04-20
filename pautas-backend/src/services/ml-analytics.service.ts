/**
 * ══════════════════════════════════════════════════════════════════════
 *  ML Analytics Service — Motor matemático de Machine Learning
 * ══════════════════════════════════════════════════════════════════════
 *
 *  PROPÓSITO:
 *    Librería de cálculo puro (sin acceso a base de datos). Provee todas
 *    las primitivas estadísticas y de ML que usan los demás servicios.
 *
 *  MÓDULOS INTERNOS:
 *    1. Álgebra de matrices   → transponer, multiplicar, invertir (Gauss-Jordan)
 *    2. Regresión OLS         → mínimos cuadrados multivariable con intervalos de confianza
 *    3. Holt-Winters          → suavizado exponencial triple (estacionalidad semanal)
 *    4. Descomposición estacional → tendencia + efecto semanal + efecto mensual + residuo
 *    5. Validación de datos   → detección de outliers (Z-Score Modificado / MAD)
 *    6. Pipeline de features  → transforma datos diarios en matriz de regresión
 *    7. Media Móvil Simple    → fallback para datasets pequeños (<14 puntos)
 *
 *  QUIÉN LO USA:
 *    ─ predictive-budget.service.ts  → regresión OLS + features + validación
 *    ─ google-ads-analysis.service.ts → Holt-Winters + SMA para forecasts
 *
 *  PARA MODIFICAR:
 *    ─ Si cambias el número de features (Sección 6), debes actualizar
 *      también predictForBudget() en predictive-budget.service.ts
 *    ─ Si cambias los z-scores de confianza (1.282 / 1.960), cambia en
 *      predictWithCI() Y en fitHoltWinters()
 * ══════════════════════════════════════════════════════════════════════
 */

// ────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────

/** Matriz 2D (array de arrays de números) para álgebra lineal */
export type Matrix = number[][];
/** Vector 1D (array de números) */
export type Vector = number[];

/**
 * Resultado completo de una regresión OLS (Ordinary Least Squares).
 * Se genera en fitOLS() y se consume en predictWithCI().
 */
export interface RegressionResult {
  /** Vector β de coeficientes de regresión. Índice 0 = intercepto */
  coefficients: number[];
  /** Nombres legibles para cada coeficiente (ej: 'intercept', 'ln_budget', ...) */
  featureNames: string[];
  /** R² — Coeficiente de determinación (0 a 1). Qué % de la varianza explica el modelo */
  r2: number;
  /** R² ajustado — penaliza por número de features. Más realista que r2 */
  adjustedR2: number;
  /** RMSE — Raíz del error cuadrático medio = sqrt(SSresidual / n) */
  rmse: number;
  /** Error estándar residual = sqrt(SSresidual / (n - p)). Estimador insesgado de σ */
  residualStdError: number;
  /** Cantidad de observaciones (filas) usadas para entrenar */
  nObservations: number;
  /** Cantidad de features (sin contar intercepto) */
  nFeatures: number;
  /**
   * Importancia por feature: coeficiente, error estándar, t-statistic,
   * p-value y si es estadísticamente significativo (p < 0.05)
   */
  featureImportance: {
    feature: string;
    /** Valor β del coeficiente — magnitud y dirección del efecto */
    coefficient: number;
    /** Error estándar del coeficiente: σ * sqrt(diag((X'X)⁻¹)) */
    stdError: number;
    /** t = coeficiente / error_estándar. Mayor |t| = más significativo */
    tStatistic: number;
    /** p-value bilateral. Si < 0.05, el feature es estadísticamente significativo */
    pValue: number;
    significant: boolean;
  }[];
  /** Ecuación legible del modelo, ej: "y = 1.23 + 0.45*ln_budget + ..." */
  equation: string;
  /**
   * Matriz (X'X)⁻¹ guardada para calcular intervalos de confianza
   * en predicciones futuras. NO eliminar — la usa predictWithCI()
   */
  _xtxInverse: Matrix;
}

/**
 * Predicción puntual con intervalos de confianza al 80% y 95%.
 * Generada por predictWithCI().
 */
export interface PredictionWithCI {
  /** Valor predicho (conversiones diarias o costo) */
  predicted: number;
  /** Límite inferior al 80% de confianza (z = 1.282) */
  ci80Lower: number;
  /** Límite superior al 80% de confianza */
  ci80Upper: number;
  /** Límite inferior al 95% de confianza (z = 1.960) */
  ci95Lower: number;
  /** Límite superior al 95% de confianza */
  ci95Upper: number;
}

/**
 * Resultado de Holt-Winters — suavizado exponencial triple.
 * Captura nivel, tendencia y estacionalidad semanal.
 */
export interface HoltWintersResult {
  /** Valores ajustados in-sample (misma longitud que los datos) */
  fitted: number[];
  /** Residuos = dato_real - valor_ajustado */
  residuals: number[];
  /** Pronóstico out-of-sample (longitud = forecastHorizon) */
  forecast: number[];
  /** Intervalos de confianza al 80% para cada paso del forecast */
  forecastCI80: { lower: number; upper: number }[];
  /** Intervalos de confianza al 95% para cada paso del forecast */
  forecastCI95: { lower: number; upper: number }[];
  /** Factores estacionales (7 valores para estacionalidad semanal) */
  seasonalPattern: number[];
  /** Último nivel estimado (componente de nivel) */
  level: number;
  /** Última tendencia estimada (incremento por periodo) */
  trend: number;
  /** Parámetros óptimos encontrados por grid search */
  params: { alpha: number; beta: number; gamma: number };
  /** RMSE del ajuste in-sample */
  rmse: number;
  /** MAPE (%) — Error porcentual absoluto medio. < 10% = excelente, < 20% = bueno */
  mape: number;
  /** Tipo de modelo: multiplicativo (datos sin ceros) o aditivo (admite ceros) */
  modelType: 'multiplicative' | 'additive';
}

/**
 * Descomposición estacional de una serie temporal.
 * Separa: Observado = Tendencia + Efecto_Semanal + Efecto_Mensual + Residuo
 */
export interface SeasonalDecomposition {
  /** Tendencia suavizada (media móvil centrada, ventana=7) */
  trend: number[];
  /** 7 valores (Dom–Sáb) — efecto semanal centrado en cero */
  seasonalWeekly: number[];
  /** 12 valores (Ene–Dic) — efecto mensual centrado en cero */
  seasonalMonthly: number[];
  /** Residuo = observado - tendencia - semanal - mensual */
  residual: number[];
  /** Fuerza semanal (0–1). >0.3 = patrón semanal notable */
  weeklyStrength: number;
  /** Fuerza mensual (0–1). >0.3 = patrón mensual notable */
  monthlyStrength: number;
}

/**
 * Reporte de calidad de datos. Determina qué análisis son
 * confiables según la cantidad y calidad de los datos.
 */
export interface DataQualityReport {
  totalRows: number;
  dateRange: { from: string; to: string };
  /** Días calendario faltantes dentro del rango */
  missingDays: number;
  /** Cantidad de outliers (Z-Score Modificado > 3.5) */
  outlierCount: number;
  /** Fechas de los primeros 10 outliers */
  outlierDates: string[];
  /** Días con costo = 0 */
  zeroCostDays: number;
  /** Días con conversiones = 0 */
  zeroConversionDays: number;
  /** true si hay un cambio de nivel significativo entre 1ª y 2ª mitad */
  stationarityWarning: boolean;
  /**
   * Score 0–100 (más alto = mejor). Penalizaciones:
   *   -20: proporción de días faltantes
   *   -15: proporción de outliers
   *   -20: >30% días con costo 0
   *   -10: warning de estacionariedad
   *   -30: <90 días   |  -10: <365 días
   */
  dataQualityScore: number;
  warnings: string[];
  /** true si hay ≥ 28 días (4 semanas completas) */
  sufficientForWeeklySeasonality: boolean;
  /** true si hay ≥ 365 días (1 año completo) */
  sufficientForMonthlySeasonality: boolean;
  /** true si hay ≥ 90 días (datos suficientes para regresión) */
  sufficientForRegression: boolean;
}

/**
 * Fila diaria de datos — estructura que viene de la query SQL
 * en predictive-budget.service.ts y se pasa a buildFeatureMatrix().
 */
export interface DailyRow {
  snapshot_date: string;
  /** Gasto total del día en USD */
  daily_cost: number;
  /** Conversiones totales del día */
  daily_conversions: number;
  daily_clicks: number;
  daily_impressions: number;
  /** Presupuesto diario promedio asignado */
  avg_daily_budget: number;
  /** Cuota de impresiones de búsqueda (0–1). null si no hay datos */
  avg_impression_share: number | null;
  /** % de cuota de impresiones perdida por presupuesto (0–1). null si no hay datos */
  avg_budget_lost_is: number | null;
  /** % de cuota de impresiones perdida por ranking (0–1). null si no hay datos */
  avg_rank_lost_is: number | null;
  /** Quality Score promedio de keywords (1–10). null si no hay keywords */
  avg_quality_score: number | null;
  /** Día de la semana: 0=Domingo, 1=Lunes, ... 6=Sábado */
  day_of_week: number;
  /** Mes del año: 1=Enero, ... 12=Diciembre */
  month_of_year: number;
}

// ────────────────────────────────────────────────────────────────
//  1. Álgebra de Matrices
//     Operaciones básicas necesarias para resolver β = (X'X)⁻¹X'Y
// ────────────────────────────────────────────────────────────────

/** Transponer matriz: T[j][i] = A[i][j]. Convierte filas en columnas */
export function matTranspose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const T: Matrix = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

/**
 * Multiplicación de matrices A×B.
 * Usa loop i-k-j para mejor cache locality. Salta bloques donde A[i][k]=0.
 */
export function matMultiply(A: Matrix, B: Matrix): Matrix {
  const aRows = A.length;
  const aCols = A[0].length;
  const bCols = B[0].length;
  const C: Matrix = Array.from({ length: aRows }, () => new Array(bCols).fill(0));
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      if (A[i][k] === 0) continue;
      for (let j = 0; j < bCols; j++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

/**
 * Inversa de matriz por eliminación Gauss-Jordan con pivoteo parcial.
 * Construye [A|I], transforma A en I → la mitad derecha queda como A⁻¹.
 * Retorna null si la matriz es singular (pivote < 1e-12).
 */
export function matInverse(A: Matrix): Matrix | null {
  const n = A.length;
  // Augmented [A | I]
  const aug: Matrix = A.map((row, i) => {
    const augRow = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) augRow[j] = row[j];
    augRow[n + i] = 1;
    return augRow;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(aug[row][col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxVal < 1e-12) return null; // singular
    if (maxRow !== col) { [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]; }

    // Scale pivot row
    const pivotVal = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivotVal;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

/** Multiplica matriz por vector columna → vector columna. Cada fila = dot product */
function matVecMultiply(A: Matrix, v: Vector): Vector {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

// ────────────────────────────────────────────────────────────────
//  2. Regresión OLS (Ordinary Least Squares) Multi-Variable
//     Fórmula: β = (X'X)⁻¹ X'Y
//     Predice conversiones a partir de presupuesto, IS, QS, etc.
// ────────────────────────────────────────────────────────────────

/**
 * CDF normal estándar aproximada (Abramowitz & Stegun 26.2.17).
 * Convierte t-statistics en p-values para validar significancia.
 */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

/**
 * Ajusta una regresión OLS multivariable.
 *
 * PASOS:
 *   1. X'X          → matriz normal (producto cruzado de features)
 *   2. (X'X)⁻¹      → inversa para resolver el sistema
 *   3. β = (X'X)⁻¹X'Y  → coeficientes de regresión
 *   4. ŷ = Xβ       → valores ajustados
 *   5. Residuos = Y - ŷ
 *   6. R² = 1 - SSresidual/SStotal
 *   7. Por cada coeficiente: SE, t-stat, p-value
 *
 * @param X - Matriz de features. Columna 0 DEBE ser todo 1s (intercepto)
 * @param Y - Vector objetivo (conversiones o costo diario)
 * @param featureNames - Nombres para cada columna de X
 * @returns null si n ≤ p o si la matriz es singular
 */
export function fitOLS(
  X: Matrix,
  Y: Vector,
  featureNames: string[],
): RegressionResult | null {
  const n = X.length;
  const p = X[0].length; // includes intercept

  if (n <= p) return null; // Necesitamos más observaciones que parámetros

  const Xt = matTranspose(X);           // X transpuesta
  const XtX = matMultiply(Xt, X);       // Matriz normal X'X
  const XtXInv = matInverse(XtX);       // Inversa (X'X)⁻¹
  if (!XtXInv) return null;             // Singular = features linealmente dependientes

  // β = (X'X)⁻¹ * X'Y  →  vector de coeficientes
  const XtY = matVecMultiply(Xt, Y);
  const beta = matVecMultiply(XtXInv, XtY);

  // Valores ajustados ŷ y residuos (error del modelo)
  const yHat = X.map(row => row.reduce((s, xi, j) => s + xi * beta[j], 0));
  const residuals = Y.map((yi, i) => yi - yHat[i]);

  // Sumas de cuadrados para R²
  const yMean = Y.reduce((s, v) => s + v, 0) / n; // media de Y
  let ssTotal = 0, ssResidual = 0;                 // SStotal, SSresidual
  for (let i = 0; i < n; i++) {
    ssTotal += (Y[i] - yMean) ** 2;
    ssResidual += residuals[i] ** 2;
  }

  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;     // R²: 1 = perfecto, 0 = no explica nada
  const adjustedR2 = 1 - (1 - r2) * (n - 1) / (n - p);      // Ajustado por nº de features
  const sigma2 = ssResidual / (n - p);                        // Varianza residual insesgada
  const sigma = Math.sqrt(sigma2);                            // σ — desviación estándar residual
  const rmse = Math.sqrt(ssResidual / n);                     // Error cuadrático medio

  // Por cada coeficiente: error estándar, t-stat y p-value
  const featureImportance = beta.map((b, j) => {
    const se = sigma * Math.sqrt(Math.max(0, XtXInv[j][j])); // SE_j = σ * √(diag(X'X)⁻¹)
    const t = se > 1e-15 ? b / se : 0;                        // t-stat = β/SE
    // p-value bilateral (aproximación normal, válida para n-p > 30)
    const pVal = 2 * (1 - normalCDF(Math.abs(t)));
    return {
      feature: featureNames[j],
      coefficient: b,
      stdError: se,
      tStatistic: t,
      pValue: pVal,
      significant: pVal < 0.05,
    };
  });

  // Build equation string
  const parts = featureImportance.map((f, i) => {
    if (i === 0) return f.coefficient.toFixed(4);
    const sign = f.coefficient >= 0 ? '+' : '';
    return `${sign}${f.coefficient.toFixed(4)}*${f.feature}`;
  });
  const equation = `y = ${parts.join(' ')}`;

  return {
    coefficients: beta,
    featureNames,
    r2,
    adjustedR2,
    rmse,
    residualStdError: sigma,
    nObservations: n,
    nFeatures: p - 1, // exclude intercept
    featureImportance,
    equation,
    _xtxInverse: XtXInv,
  };
}

/**
 * Predice un valor nuevo con intervalos de confianza al 80% (z=1.282) y 95% (z=1.960).
 *
 * FÓRMULA DE VARIANZA DE PREDICCIÓN:
 *   Var(pred) = σ² × (1 + x'(X'X)⁻¹x)
 *   El "1 +" agrega la incertidumbre inherente de nuevas observaciones
 *   (no solo la incertidumbre de la estimación de la media).
 *
 * Todos los límites inferiores se clampean a 0 (conversiones no pueden ser negativas).
 */
export function predictWithCI(
  model: RegressionResult,
  xNew: Vector,
): PredictionWithCI {
  const predicted = xNew.reduce((s, xi, j) => s + xi * model.coefficients[j], 0); // ŷ = x'β
  const sigma = model.residualStdError;

  // Varianza de predicción = σ² × (1 + x'(X'X)⁻¹x)
  const tmp = matVecMultiply(model._xtxInverse, xNew); // (X'X)⁻¹ × x
  const xInvX = xNew.reduce((s, xi, j) => s + xi * tmp[j], 0); // x' × ((X'X)⁻¹ × x)
  const sePred = sigma * Math.sqrt(1 + xInvX); // Error estándar de predicción

  return {
    predicted: Math.max(0, predicted),
    ci80Lower: Math.max(0, predicted - 1.282 * sePred),
    ci80Upper: predicted + 1.282 * sePred,
    ci95Lower: Math.max(0, predicted - 1.960 * sePred),
    ci95Upper: predicted + 1.960 * sePred,
  };
}

// ────────────────────────────────────────────────────────────────
//  3. Holt-Winters — Suavizado Exponencial Triple
//     Captura: Nivel (L) + Tendencia (T) + Estacionalidad (S)
//     Se usa para forecast de costo y conversiones a 30/90 días.
//     Parámetros α, β, γ se optimizan por grid search.
// ────────────────────────────────────────────────────────────────

/** Media aritmética */
function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

/** Varianza muestral (divide por n-1, estimador insesgado) */
function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

interface HWParams { alpha: number; beta: number; gamma: number }

/**
 * Ejecuta una pasada de Holt-Winters sobre los datos.
 *
 * ECUACIONES DE ACTUALIZACIÓN:
 *   Multiplicativo:
 *     L(t) = α × (Y(t) / S(t-s)) + (1-α) × (L(t-1) + T(t-1))
 *     T(t) = β × (L(t) - L(t-1)) + (1-β) × T(t-1)
 *     S(t) = γ × (Y(t) / L(t)) + (1-γ) × S(t-s)
 *     Ŷ(t) = (L(t-1) + T(t-1)) × S(t-s)
 *
 *   Aditivo (cuando hay ceros en los datos):
 *     L(t) = α × (Y(t) - S(t-s)) + (1-α) × (L(t-1) + T(t-1))
 *     T(t) = β × (L(t) - L(t-1)) + (1-β) × T(t-1)
 *     S(t) = γ × (Y(t) - L(t)) + (1-γ) × S(t-s)
 *     Ŷ(t) = (L(t-1) + T(t-1)) + S(t-s)
 *
 * @param data - Serie temporal de valores diarios
 * @param s - Longitud del ciclo estacional (7 para semanal)
 * @param params - α (nivel), β (tendencia), γ (estacionalidad)
 * @param modelType - 'multiplicative' o 'additive'
 */
function runHoltWinters(
  data: number[],
  s: number,
  params: HWParams,
  modelType: 'multiplicative' | 'additive',
): { fitted: number[]; residuals: number[]; level: number; trend: number; seasonal: number[] } {
  const n = data.length;
  const { alpha, beta, gamma } = params;

  // Inicialización: L = media de la primera temporada, T = pendiente entre temporadas
  const firstSeason = data.slice(0, s);
  const secondSeason = data.slice(s, 2 * s);
  let L = mean(firstSeason);                                           // Nivel inicial
  let T = secondSeason.length >= s ? (mean(secondSeason) - mean(firstSeason)) / s : 0; // Tendencia inicial
  const S = new Array(n + s).fill(0); // Factores estacionales (se van actualizando)

  if (modelType === 'multiplicative') {
    for (let i = 0; i < s; i++) S[i] = L > 0 ? firstSeason[i] / L : 1;
  } else {
    for (let i = 0; i < s; i++) S[i] = firstSeason[i] - L;
  }

  const fitted: number[] = [];
  const residuals: number[] = [];

  for (let t = 0; t < n; t++) {
    const y = data[t];
    const sPrev = S[t]; // seasonal factor from s periods ago (for t >= s it wraps)

    let newL: number, newT: number, newS: number, fit: number;

    if (modelType === 'multiplicative') {
      const safeSPrev = Math.abs(sPrev) > 1e-10 ? sPrev : 1;
      newL = alpha * (y / safeSPrev) + (1 - alpha) * (L + T);
      newT = beta * (newL - L) + (1 - beta) * T;
      newS = gamma * (newL > 1e-10 ? y / newL : 1) + (1 - gamma) * sPrev;
      fit = (L + T) * sPrev;
    } else {
      newL = alpha * (y - sPrev) + (1 - alpha) * (L + T);
      newT = beta * (newL - L) + (1 - beta) * T;
      newS = gamma * (y - newL) + (1 - gamma) * sPrev;
      fit = (L + T) + sPrev;
    }

    fitted.push(Math.max(0, fit));
    residuals.push(y - fit);

    L = newL;
    T = newT;
    S[t + s] = newS;
  }

  // Extract final seasonal pattern
  const seasonal = S.slice(n, n + s);

  return { fitted, residuals, level: L, trend: T, seasonal };
}

/**
 * Ajusta Holt-Winters con optimización de hiperparámetros por grid search.
 *
 * FLUJO:
 *   1. Auto-detecta tipo (multiplicativo si <10% de datos son cero/negativo)
 *   2. Divide datos en train (80%) / validation (20%)
 *   3. Prueba 384 combinaciones de α×β×γ, selecciona la que minimiza RMSE de validación
 *   4. Re-entrena con todos los datos usando los mejores parámetros
 *   5. Genera forecast con intervalos de confianza crecientes
 *
 * VARIANZA DEL FORECAST (crece con el horizonte h):
 *   Var(h) = σ²_residual × (1 + (h-1) × α² × (1 + h×β + h×(h-1)×β²/6))
 *
 * @param data - Serie temporal diaria (mínimo 2 temporadas completas)
 * @param seasonLength - Longitud del ciclo (default 7 = semanal)
 * @param forecastHorizon - Días a proyectar (default 30)
 * @returns null si hay menos de 2 temporadas completas de datos
 */
export function fitHoltWinters(
  data: number[],
  seasonLength: number = 7,
  forecastHorizon: number = 30,
  preferredModelType?: 'multiplicative' | 'additive' | 'auto',
): HoltWintersResult | null {
  const n = data.length;
  if (n < seasonLength * 2) return null; // need at least 2 full seasons

  // Auto-detect model type
  let modelType: 'multiplicative' | 'additive';
  if (preferredModelType && preferredModelType !== 'auto') {
    modelType = preferredModelType;
  } else {
    const zeroCount = data.filter(v => v <= 0).length;
    modelType = zeroCount / n > 0.1 ? 'additive' : 'multiplicative';
  }

  // Train/validation split (80/20)
  const trainSize = Math.max(seasonLength * 2, Math.floor(n * 0.8));
  const trainData = data.slice(0, trainSize);
  const valData = data.slice(trainSize);

  const alphaGrid = [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];
  const betaGrid = [0.01, 0.05, 0.1, 0.2, 0.3, 0.5];
  const gammaGrid = [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];

  let bestParams: HWParams = { alpha: 0.3, beta: 0.1, gamma: 0.3 };
  let bestRMSE = Infinity;

  // Grid search
  for (const alpha of alphaGrid) {
    for (const beta of betaGrid) {
      for (const gamma of gammaGrid) {
        try {
          const result = runHoltWinters(trainData, seasonLength, { alpha, beta, gamma }, modelType);

          // Generate out-of-sample forecasts
          if (valData.length > 0) {
            let valSSE = 0;
            for (let h = 0; h < valData.length; h++) {
              const seasonIdx = h % seasonLength;
              let forecast: number;
              if (modelType === 'multiplicative') {
                forecast = (result.level + (h + 1) * result.trend) * result.seasonal[seasonIdx];
              } else {
                forecast = (result.level + (h + 1) * result.trend) + result.seasonal[seasonIdx];
              }
              valSSE += (valData[h] - forecast) ** 2;
            }
            const valRMSE = Math.sqrt(valSSE / valData.length);
            if (valRMSE < bestRMSE) {
              bestRMSE = valRMSE;
              bestParams = { alpha, beta, gamma };
            }
          }
        } catch {
          // Skip invalid combination
        }
      }
    }
  }

  // Refit on full data with best params
  const fullResult = runHoltWinters(data, seasonLength, bestParams, modelType);

  // Calculate fit metrics
  const fitResiduals = fullResult.residuals;
  const rmse = Math.sqrt(fitResiduals.reduce((s, r) => s + r * r, 0) / n);
  let mapeSum = 0, mapeCount = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(data[i]) > 1e-10) {
      mapeSum += Math.abs(fitResiduals[i] / data[i]);
      mapeCount++;
    }
  }
  const mape = mapeCount > 0 ? (mapeSum / mapeCount) * 100 : 0;

  // Residual standard deviation for CI calculation
  const residualVar = variance(fitResiduals);
  const sigma = Math.sqrt(residualVar);

  // Generate forecast with confidence intervals
  const forecast: number[] = [];
  const forecastCI80: { lower: number; upper: number }[] = [];
  const forecastCI95: { lower: number; upper: number }[] = [];

  for (let h = 1; h <= forecastHorizon; h++) {
    const seasonIdx = (h - 1) % seasonLength;
    let point: number;
    if (modelType === 'multiplicative') {
      point = (fullResult.level + h * fullResult.trend) * fullResult.seasonal[seasonIdx];
    } else {
      point = (fullResult.level + h * fullResult.trend) + fullResult.seasonal[seasonIdx];
    }
    point = Math.max(0, point);

    // Variance grows with horizon
    const varianceH = residualVar * (1 + (h - 1) * bestParams.alpha * bestParams.alpha
      * (1 + h * bestParams.beta + h * (h - 1) * bestParams.beta * bestParams.beta / 6));
    const seH = Math.sqrt(varianceH);

    forecast.push(point);
    forecastCI80.push({
      lower: Math.max(0, point - 1.282 * seH),
      upper: point + 1.282 * seH,
    });
    forecastCI95.push({
      lower: Math.max(0, point - 1.960 * seH),
      upper: point + 1.960 * seH,
    });
  }

  return {
    fitted: fullResult.fitted,
    residuals: fitResiduals,
    forecast,
    forecastCI80,
    forecastCI95,
    seasonalPattern: fullResult.seasonal,
    level: fullResult.level,
    trend: fullResult.trend,
    params: bestParams,
    rmse,
    mape,
    modelType,
  };
}

// ────────────────────────────────────────────────────────────────
//  4. Descomposición Estacional
//     Separa: Observado = Tendencia + Efecto_Semanal + Efecto_Mensual + Residuo
//     Tendencia = media móvil centrada (ventana 7 días)
// ────────────────────────────────────────────────────────────────

/**
 * Descompone una serie temporal en sus componentes.
 *
 * PASOS:
 *   1. Tendencia: media móvil centrada (3 días antes + día + 3 días después)
 *   2. Detrend: valores - tendencia
 *   3. Estacionalidad semanal: promedio de los detrended por día de semana (0=Dom..6=Sáb)
 *   4. Estacionalidad mensual: promedio de los detrended por mes (0=Ene..11=Dic)
 *   5. Residuo: observado - tendencia - semanal - mensual
 *   6. Fuerza = 1 - Var(residuo) / (Var(componente) + Var(residuo))
 *      Si fuerza > 0.3, el patrón es notable y vale la pena considerarlo.
 *
 * @param values - Valores diarios de la métrica (conversiones, costo, etc.)
 * @param dates - Fechas alineadas con values (formato 'YYYY-MM-DD')
 */
export function decomposeSeasonality(
  values: number[],
  dates: string[],
): SeasonalDecomposition {
  const n = values.length;

  // -- Trend via centered moving average (window=7) --
  const trend = new Array(n).fill(NaN);
  const halfW = 3;
  for (let i = halfW; i < n - halfW; i++) {
    let sum = 0;
    for (let j = i - halfW; j <= i + halfW; j++) sum += values[j];
    trend[i] = sum / 7;
  }
  // Fill edges with nearest valid
  for (let i = 0; i < halfW; i++) trend[i] = trend[halfW];
  for (let i = n - halfW; i < n; i++) trend[i] = trend[n - halfW - 1];

  // -- Detrend --
  const detrended = values.map((v, i) => v - trend[i]);

  // -- Weekly seasonal component (0=Sun, 1=Mon, ... 6=Sat) --
  const weekBuckets: number[][] = [[], [], [], [], [], [], []];
  for (let i = 0; i < n; i++) {
    const d = new Date(dates[i]);
    const dow = d.getUTCDay(); // 0=Sun
    weekBuckets[dow].push(detrended[i]);
  }
  const rawWeekly = weekBuckets.map(b => b.length > 0 ? mean(b) : 0);
  const weeklyMean = mean(rawWeekly);
  const seasonalWeekly = rawWeekly.map(v => v - weeklyMean); // zero-centered

  // -- Monthly seasonal component (0=Jan, ... 11=Dec) --
  const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < n; i++) {
    const d = new Date(dates[i]);
    const m = d.getUTCMonth(); // 0=Jan
    monthBuckets[m].push(detrended[i]);
  }
  const rawMonthly = monthBuckets.map(b => b.length > 0 ? mean(b) : 0);
  const monthlyMean = mean(rawMonthly);
  const seasonalMonthly = rawMonthly.map(v => v - monthlyMean);

  // -- Residual: observed - trend - weekSeasonal - monthSeasonal --
  const residual = values.map((v, i) => {
    const d = new Date(dates[i]);
    const dow = d.getUTCDay();
    const m = d.getUTCMonth();
    return v - trend[i] - seasonalWeekly[dow] - seasonalMonthly[m];
  });

  // -- Strength of seasonality --
  const varWeekly = variance(
    values.map((_, i) => {
      const d = new Date(dates[i]);
      return seasonalWeekly[d.getUTCDay()];
    }),
  );
  const varMonthly = variance(
    values.map((_, i) => {
      const d = new Date(dates[i]);
      return seasonalMonthly[d.getUTCMonth()];
    }),
  );
  const varResidual = variance(residual);
  const totalSeasonalVar = varWeekly + varMonthly + varResidual;

  const weeklyStrength = totalSeasonalVar > 0 ? 1 - varResidual / (varWeekly + varResidual) : 0;
  const monthlyStrength = totalSeasonalVar > 0 ? 1 - varResidual / (varMonthly + varResidual) : 0;

  return {
    trend,
    seasonalWeekly,
    seasonalMonthly,
    residual,
    weeklyStrength: Math.max(0, Math.min(1, weeklyStrength)),
    monthlyStrength: Math.max(0, Math.min(1, monthlyStrength)),
  };
}

// ────────────────────────────────────────────────────────────────
//  5. Validación de Calidad de Datos
//     Evalúa si los datos son suficientes y confiables antes de
//     correr modelos de ML. Score 0–100, advertencias en español.
// ────────────────────────────────────────────────────────────────

/**
 * Z-Score Modificado usando MAD (Median Absolute Deviation).
 * Más robusto que Z-Score tradicional contra outliers extremos.
 *
 * Fórmula: modZ = 0.6745 × (valor - mediana) / MAD
 * El 0.6745 normaliza MAD para que sea equivalente a σ en distribución normal.
 * Umbral: |modZ| > 3.5 = outlier
 */
function modifiedZScores(data: number[]): number[] {
  const sorted = [...data].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const absDevs = data.map(v => Math.abs(v - median));
  const sortedDevs = [...absDevs].sort((a, b) => a - b);
  const mad = sortedDevs[Math.floor(sortedDevs.length / 2)];
  if (mad < 1e-10) return data.map(() => 0); // all values essentially the same
  return data.map(v => 0.6745 * (v - median) / mad);
}

/**
 * Valida la calidad de los datos antes de entrenar modelos.
 *
 * VALIDACIONES:
 *   - Días faltantes en el rango de fechas
 *   - Outliers en costo diario (Z-Score Modificado > 3.5)
 *   - Días con costo 0 y con conversiones 0
 *   - Estacionariedad: ¿cambió significativamente el nivel?
 *     (compara media de 1ª mitad vs 2ª mitad, alerta si difieren > 2σ)
 *   - Suficiencia mínima de datos para cada tipo de análisis
 */
export function validateDataQuality(
  rows: DailyRow[],
): DataQualityReport {
  const n = rows.length;
  const warnings: string[] = [];

  if (n === 0) {
    return {
      totalRows: 0,
      dateRange: { from: '', to: '' },
      missingDays: 0,
      outlierCount: 0,
      outlierDates: [],
      zeroCostDays: 0,
      zeroConversionDays: 0,
      stationarityWarning: false,
      dataQualityScore: 0,
      warnings: ['No data available'],
      sufficientForWeeklySeasonality: false,
      sufficientForMonthlySeasonality: false,
      sufficientForRegression: false,
    };
  }

  const firstDate = rows[0].snapshot_date;
  const lastDate = rows[n - 1].snapshot_date;

  // Missing days
  const dateSet = new Set(rows.map(r => r.snapshot_date));
  const start = new Date(firstDate);
  const end = new Date(lastDate);
  let expectedDays = 0;
  let missingDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    expectedDays++;
    if (!dateSet.has(d.toISOString().split('T')[0])) missingDays++;
  }

  // Outliers on daily_cost
  const costs = rows.map(r => r.daily_cost);
  const zScores = modifiedZScores(costs);
  const outlierIndices = zScores.reduce<number[]>((acc, z, i) => {
    if (Math.abs(z) > 3.5) acc.push(i);
    return acc;
  }, []);
  const outlierDates = outlierIndices.slice(0, 10).map(i => rows[i].snapshot_date);

  // Zero days
  const zeroCostDays = rows.filter(r => r.daily_cost <= 0).length;
  const zeroConversionDays = rows.filter(r => r.daily_conversions <= 0).length;

  // Stationarity check: split in halves, compare means
  const half = Math.floor(n / 2);
  const mean1 = mean(costs.slice(0, half));
  const mean2 = mean(costs.slice(half));
  const overallStd = Math.sqrt(variance(costs));
  const stationarityWarning = overallStd > 0 && Math.abs(mean2 - mean1) > 2 * overallStd;

  // Score
  let score = 100;
  if (expectedDays > 0) score -= (missingDays / expectedDays) * 20;
  if (n > 0) score -= (outlierIndices.length / n) * 15;
  if (n > 0 && zeroCostDays / n > 0.3) score -= 20;
  if (stationarityWarning) score -= 10;
  if (n < 90) score -= 30;
  else if (n < 365) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Warnings
  if (missingDays > 0) warnings.push(`${missingDays} dias sin datos en el rango`);
  if (outlierIndices.length > 0) warnings.push(`${outlierIndices.length} outliers detectados`);
  if (stationarityWarning) warnings.push('Cambio significativo de nivel detectado entre primera y segunda mitad del periodo');
  if (n < 28) warnings.push('Menos de 28 dias — insuficiente para estacionalidad semanal');
  if (n < 365) warnings.push('Menos de 365 dias — estacionalidad mensual puede ser imprecisa');
  if (n < 90) warnings.push('Menos de 90 dias — regresion multi-variable poco confiable');

  return {
    totalRows: n,
    dateRange: { from: firstDate, to: lastDate },
    missingDays,
    outlierCount: outlierIndices.length,
    outlierDates,
    zeroCostDays,
    zeroConversionDays,
    stationarityWarning,
    dataQualityScore: score,
    warnings,
    sufficientForWeeklySeasonality: n >= 28,
    sufficientForMonthlySeasonality: n >= 365,
    sufficientForRegression: n >= 90,
  };
}

// ────────────────────────────────────────────────────────────────
//  6. Pipeline de Feature Engineering
//     Transforma filas diarias de BD en una matriz numérica
//     lista para regresión OLS.
//
//     FEATURES (9 columnas):
//       [0] intercept    = 1 (constante)
//       [1] ln_budget    = ln(presupuesto + 1)  → rendimiento decreciente
//       [2] impression_share = cuota de impresiones (0–1)
//       [3] budget_adequacy  = 1 - budget_lost_is  → qué tanto NO pierdes por presupuesto
//       [4] quality_factor   = quality_score / 10   → normalizado a [0,1]
//       [5] sin_dow     = sin(2π × dow / 7)  → codificación cíclica semanal (componente seno)
//       [6] cos_dow     = cos(2π × dow / 7)  → codificación cíclica semanal (componente coseno)
//       [7] sin_month   = sin(2π × mes / 12) → codificación cíclica anual (componente seno)
//       [8] cos_month   = cos(2π × mes / 12) → codificación cíclica anual (componente coseno)
//
//     ¿POR QUÉ ln(budget)?
//       Duplicar presupuesto de $100→$200 tiene más impacto que de $10000→$10100.
//       El logaritmo captura este efecto de rendimientos decrecientes.
//
//     ¿POR QUÉ sin/cos en vez de variables dummy?
//       Las codificaciones cíclicas evitan discontinuidades artificiales
//       (ej: día 6→día 0 sería un salto en dummy, pero en sin/cos es continuo).
//
//     IMPUTACIÓN:
//       Valores null de IS, budget_lost_is y QS se reemplazan por su mediana.
//
//     PARA MODIFICAR FEATURES:
//       1. Cambiar el array featureNames
//       2. Cambiar el push a X[]
//       3. Actualizar predictForBudget() en predictive-budget.service.ts
//          (el vector xNew debe tener la misma estructura)
// ────────────────────────────────────────────────────────────────

/** Resultado del pipeline de features: matrices listas para fitOLS() */
export interface FeatureEngineResult {
  /** Matriz de features [n_filas × 9_columnas] con intercepto incluido */
  X: Matrix;
  /** Vector objetivo: conversiones diarias o costo diario */
  Y: Vector;
  /** Nombres de cada columna de X */
  featureNames: string[];
  /** Filas válidas usadas (misma longitud que X e Y) */
  validRows: DailyRow[];
}

/**
 * Construye la matriz de features X y el vector Y desde las filas diarias.
 * Imputa valores nulos con la mediana del dataset.
 *
 * @param rows - Filas diarias (de la query SQL de predictive-budget.service)
 * @param target - 'conversions' (default) o 'cost' como variable objetivo
 */
export function buildFeatureMatrix(
  rows: DailyRow[],
  target: 'conversions' | 'cost' = 'conversions',
): FeatureEngineResult {
  const n = rows.length;

  // Medianas para imputar valores null
  const isValues = rows.filter(r => r.avg_impression_share !== null).map(r => r.avg_impression_share!);
  const blisValues = rows.filter(r => r.avg_budget_lost_is !== null).map(r => r.avg_budget_lost_is!);
  const qsValues = rows.filter(r => r.avg_quality_score !== null).map(r => r.avg_quality_score!);

  const medianIS = isValues.length > 0 ? sortedMedian(isValues) : 0;    // Default 0 si no hay datos de IS
  const medianBLIS = blisValues.length > 0 ? sortedMedian(blisValues) : 0;
  const medianQS = qsValues.length > 0 ? sortedMedian(qsValues) : 5;    // Default 5 (medio) si no hay QS

  const featureNames = [
    'intercept', 'ln_budget', 'impression_share', 'budget_adequacy',
    'quality_factor', 'sin_dow', 'cos_dow', 'sin_month', 'cos_month',
  ];

  const X: Matrix = [];
  const Y: Vector = [];
  const validRows: DailyRow[] = [];

  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const budget = Math.max(r.avg_daily_budget, 0.01);
    const is_val = r.avg_impression_share ?? medianIS;
    const blis_val = r.avg_budget_lost_is ?? medianBLIS;
    const qs_val = r.avg_quality_score ?? medianQS;

    const dow = r.day_of_week;
    const month = r.month_of_year;

    X.push([
      1,                                          // [0] intercepto
      Math.log(budget + 1),                        // [1] ln(presupuesto+1), +1 evita ln(0)
      is_val,                                      // [2] cuota de impresiones
      1 - blis_val,                                // [3] adecuación de presupuesto (1 = nada se pierde por budget)
      qs_val / 10,                                 // [4] quality score normalizado a [0,1]
      Math.sin(2 * Math.PI * dow / 7),             // [5] componente seno del día de la semana
      Math.cos(2 * Math.PI * dow / 7),             // [6] componente coseno del día de la semana
      Math.sin(2 * Math.PI * month / 12),          // [7] componente seno del mes
      Math.cos(2 * Math.PI * month / 12),          // [8] componente coseno del mes
    ]);
    Y.push(target === 'conversions' ? r.daily_conversions : r.daily_cost);
    validRows.push(r);
  }

  return { X, Y, featureNames, validRows };
}

/** Calcula la mediana de un array numérico (crea copia ordenada) */
function sortedMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ────────────────────────────────────────────────────────────────
//  7. Media Móvil Simple (SMA) — Fallback para datasets pequeños
//     Se usa cuando hay < 14 datos (< 2 temporadas para Holt-Winters).
//     Genera un forecast plano (valor constante = media de últimos N datos).
// ────────────────────────────────────────────────────────────────

/**
 * Forecast por media móvil simple.
 * Toma el promedio de los últimos `window` datos y lo repite `horizon` veces.
 * Error estándar: σ × √(1 + 1/w) — incluye incertidumbre por ventana finita.
 * IC 95%: media ± 1.96 × SE
 *
 * @param data - Serie temporal completa
 * @param window - Ventana de la media móvil (default 7 = última semana)
 * @param horizon - Días a proyectar (default 30)
 */

export function simpleMovingAverageForecast(
  data: number[],
  window: number = 7,
  horizon: number = 30,
): { forecast: number[]; ci95: { lower: number; upper: number }[] } {
  const n = data.length;
  const w = Math.min(window, n);
  const recent = data.slice(n - w);
  const avg = mean(recent);
  const std = Math.sqrt(variance(recent));

  const forecast: number[] = [];
  const ci95: { lower: number; upper: number }[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(Math.max(0, avg));
    const se = std * Math.sqrt(1 + 1 / w); // simple prediction SE
    ci95.push({
      lower: Math.max(0, avg - 1.96 * se),
      upper: avg + 1.96 * se,
    });
  }

  return { forecast, ci95 };
}
