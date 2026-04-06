export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type AlertType =
  | 'CONVERSION_DROP'
  | 'ZERO_EFFECTIVE'
  | 'TRAFFIC_DROP'
  | 'HIGH_MINORS_RATIO'
  | 'NO_REPORT'
  | 'CONVERSION_SPIKE'
  | 'RECORD_DAY'
  | 'TREND_DECLINING'
  | 'ADS_DISCREPANCY';

export interface Alert {
  id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  user_id: number | null;
  country_id: number | null;
  campaign_id: number | null;
  daily_entry_id: number | null;
  title: string;
  message: string;
  metadata: Record<string, any>;
  status: AlertStatus;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  resolved_by: number | null;
  resolved_at: string | null;
  dismissed_by: number | null;
  dismissed_at: string | null;
  created_at: string;
  // Joined fields
  user_full_name?: string;
  user_username?: string;
  country_name?: string;
  country_code?: string;
  campaign_name?: string;
  acknowledged_by_name?: string;
  resolved_by_name?: string;
  dismissed_by_name?: string;
}

export interface AlertSummary {
  critical: { active: number; total: number };
  warning: { active: number; total: number };
  info: { active: number; total: number };
}

export interface AlertTrendItem {
  date: string;
  severity: AlertSeverity;
  count: number;
}

export interface TopAlertedUser {
  user_id: number;
  full_name: string;
  username: string;
  country_name: string;
  total_alerts: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
}

export interface AlertThreshold {
  id: number;
  alert_type: string;
  country_id: number | null;
  campaign_id: number | null;
  threshold_value: number;
  is_active: boolean;
  updated_by: number | null;
  country_name?: string;
  campaign_name?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ConglomerateRanking {
  user_id: number;
  full_name: string;
  username: string;
  country_id: number;
  country_name: string;
  country_code: string;
  campaign_id: number | null;
  campaign_name: string | null;
  total_entries: number;
  total_clientes: number;
  total_efectivos: number;
  total_menores: number;
  conversion_rate: number;
  rank_in_country: number;
  last_entry_date: string | null;
}

export interface AdsComparison {
  campaign_id: number;
  campaign_name: string;
  country_name: string;
  country_code: string;
  ads_conversions: number;
  field_efectivos: number;
  total_cost: number;
  cost_per_real_client: number;
  discrepancy_pct: number;
}

export interface AlertFilters {
  severity?: AlertSeverity;
  status?: AlertStatus;
  country_id?: number;
  campaign_id?: number;
  alert_type?: AlertType;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}
