import {
  Chart,
  registerables,
  Tooltip,
  Legend,
  Plugin,
} from 'chart.js';

// ─── Register all Chart.js components ───
Chart.register(...registerables);

// ─── Design tokens (mirror CSS vars for JS context) ───
const tokens = {
  fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  gray0: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray150: '#EDEDED',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray900: '#171717',
  brandPrimary: '#141414',
  brandAccent: '#FFD600',
  brandAccentHover: '#E6C200',
  success: '#10B981',
  successDark: '#059669',
  warning: '#F59E0B',
  warningDark: '#D97706',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  info: '#3B82F6',
  infoDark: '#2563EB',
  // Country palette
  colombia: '#3B82F6',
  peru: '#10B981',
  chile: '#F59E0B',
  ecuador: '#8B5CF6',
  mexico: '#06B6D4',
  panama: '#EF4444',
  bolivia: '#F97316',
  otros: '#9CA3AF',
};

export { tokens as chartTokens };

// ─── Global defaults ───
Chart.defaults.font.family = tokens.fontFamily;
Chart.defaults.font.size = 12;
Chart.defaults.font.weight = 400;
Chart.defaults.color = tokens.gray500;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

// Disable global animations to prevent "this._fn is not a function" errors
// in Chart.js 4.x. Individual charts can re-enable with their own config.
Chart.defaults.animation = false as any;

// ─── Tooltip defaults ───
Tooltip.positioners.average = Tooltip.positioners.average; // keep default
Chart.defaults.plugins.tooltip = {
  ...Chart.defaults.plugins.tooltip,
  enabled: true,
  backgroundColor: tokens.brandPrimary,
  titleColor: tokens.gray0,
  bodyColor: tokens.gray200,
  titleFont: { family: tokens.fontFamily, size: 13, weight: 600 },
  bodyFont: { family: tokens.fontFamily, size: 12, weight: 400 },
  padding: { top: 10, bottom: 10, left: 14, right: 14 },
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 4,
  caretSize: 6,
  borderWidth: 0,
};

// ─── Legend defaults ───
Chart.defaults.plugins.legend = {
  ...Chart.defaults.plugins.legend,
  labels: {
    ...Chart.defaults.plugins.legend.labels,
    usePointStyle: true,
    pointStyle: 'circle',
    padding: 16,
    font: { family: tokens.fontFamily, size: 12, weight: 500 },
    color: tokens.gray600,
    boxWidth: 8,
    boxHeight: 8,
  },
};

// ─── Scale defaults ───
const scaleDefaults = Chart.defaults.scales as any;

// Linear scale
if (scaleDefaults.linear) {
  scaleDefaults.linear.grid = {
    ...scaleDefaults.linear.grid,
    color: tokens.gray150,
    drawBorder: false,
    lineWidth: 1,
  };
  scaleDefaults.linear.ticks = {
    ...scaleDefaults.linear.ticks,
    padding: 8,
    font: { family: tokens.fontFamily, size: 11, weight: 400 },
    color: tokens.gray400,
  };
  scaleDefaults.linear.border = { display: false };
}

// Category scale
if (scaleDefaults.category) {
  scaleDefaults.category.grid = {
    ...scaleDefaults.category.grid,
    display: false,
  };
  scaleDefaults.category.ticks = {
    ...scaleDefaults.category.ticks,
    padding: 8,
    font: { family: tokens.fontFamily, size: 11, weight: 400 },
    color: tokens.gray400,
  };
  scaleDefaults.category.border = { display: false };
}

// ─── Crosshair Plugin ───
export const crosshairPlugin: Plugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const tooltip = chart.tooltip;
    if (!tooltip || !tooltip.getActiveElements().length) return;

    const ctx = chart.ctx;
    const activeEl = tooltip.getActiveElements()[0];
    if (!activeEl) return;

    const x = activeEl.element.x;
    const topY = chart.scales['y']?.top ?? chart.chartArea.top;
    const bottomY = chart.scales['y']?.bottom ?? chart.chartArea.bottom;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = tokens.gray300;
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
    ctx.restore();
  },
};

// ─── Donut Center Text Plugin ───
export const donutCenterTextPlugin: Plugin = {
  id: 'donutCenterText',
  beforeDraw(chart) {
    const options = (chart.config.options as any)?.plugins?.donutCenterText;
    if (!options) return;

    const { text, subtext } = options;
    const { width, height, top } = chart.chartArea;
    const ctx = chart.ctx;
    const cx = width / 2 + chart.chartArea.left;
    const cy = height / 2 + top;

    ctx.save();

    // Main text
    if (text) {
      ctx.font = `700 ${Math.max(20, width * 0.1)}px ${tokens.fontFamily}`;
      ctx.fillStyle = tokens.gray900;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, subtext ? cy - 10 : cy);
    }

    // Subtext
    if (subtext) {
      ctx.font = `400 ${Math.max(11, width * 0.045)}px ${tokens.fontFamily}`;
      ctx.fillStyle = tokens.gray500;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(subtext, cx, cy + 14);
    }

    ctx.restore();
  },
};

// ─── Country color palette (ordered) ───
export const countryColors = [
  tokens.colombia,
  tokens.peru,
  tokens.chile,
  tokens.ecuador,
  tokens.mexico,
  tokens.panama,
  tokens.bolivia,
  tokens.otros,
];

// ─── Common chart option factories ───
export function lineChartDefaults(overrides: Record<string, any> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: overrides['showLegend'] ?? true },
      tooltip: { enabled: true, mode: 'index' as const, intersect: false },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        grid: { color: tokens.gray150, drawBorder: false },
        border: { display: false },
        beginAtZero: true,
      },
    },
    elements: {
      line: {
        tension: 0.3,
        borderWidth: 2,
        fill: false,
      },
      point: {
        radius: 3,
        hoverRadius: 5,
        hitRadius: 10,
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    ...overrides,
  };
}

export function barChartDefaults(overrides: Record<string, any> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: overrides['showLegend'] ?? false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        grid: { color: tokens.gray150, drawBorder: false },
        border: { display: false },
        beginAtZero: true,
      },
    },
    elements: {
      bar: {
        borderRadius: 4,
        borderSkipped: false,
      },
    },
    ...overrides,
  };
}

export function doughnutChartDefaults(overrides: Record<string, any> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: overrides['cutout'] ?? '65%',
    plugins: {
      legend: {
        display: overrides['showLegend'] ?? true,
        position: 'bottom' as const,
      },
      tooltip: { enabled: true },
    },
    ...overrides,
  };
}

// ─── Register custom plugins globally ───
Chart.register(crosshairPlugin);
Chart.register(donutCenterTextPlugin);
