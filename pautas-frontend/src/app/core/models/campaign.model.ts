export interface Campaign {
  id: number;
  googleAdsCampaignId?: string;
  name: string;
  countryId: number;
  campaignUrl?: string;
  isActive: boolean;
  countryName?: string;
  countryCode?: string;
  assignedUser?: string;
  latestStatus?: string;
  latestConversions?: number;
  latestBudget?: number;
}
