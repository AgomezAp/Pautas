export interface KpiData {
  totalEntries: number;
  usersReporting: number;
  totalClientes: number;
  totalClientesEfectivos: number;
  totalMenores: number;
  effectivenessRate: number;
  totalConversions: number;
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
  activeCampaigns: number;
  conversionRate: number;
  costPerConversion: number;
}

export interface ChartData {
  barChart: {
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
  lineChart: {
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
  pieChart: {
    labels: string[];
    datasets: { data: number[] }[];
  };
}
