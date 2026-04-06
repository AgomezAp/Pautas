export interface DailyEntry {
  id: number;
  userId: number;
  countryId: number;
  campaignId?: number;
  entryDate: string;
  isoYear: number;
  isoWeek: number;
  clientes: number;
  clientesEfectivos: number;
  menores: number;
  soporteImagePath?: string;
  soporteOriginalName?: string;
  userName?: string;
  countryName?: string;
  campaignName?: string;
  googleAdsCampaignId?: string;
  // Google Ads joined fields
  conversions?: number;
  adsStatus?: string;
  remainingBudget?: number;
  adsCost?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
}

export interface WeeklySummary {
  isoYear: number;
  isoWeek: number;
  daysWithEntries: number;
  totalClientes: number;
  totalClientesEfectivos: number;
  totalMenores: number;
  effectivenessRate: number;
  usersReporting?: number;
  countryName?: string;
}
