export interface User {
  id: number;
  username: string;
  email?: string;
  fullName: string;
  role: string;
  countryId?: number;
  campaignId?: number;
  countryName?: string;
  campaignName?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface UserCreateRequest {
  username: string;
  full_name: string;
  role_id: number;
  password?: string;
  email?: string;
  country_id?: number;
  campaign_id?: number;
  is_active?: boolean;
}
