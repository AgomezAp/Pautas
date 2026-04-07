import { Component, Input } from '@angular/core';

const ICON_MAP: Record<string, string> = {
  // Navigation
  dashboard: 'speedometer2',
  menu: 'list',
  close: 'x-lg',
  chevron_left: 'chevron-left',
  chevron_right: 'chevron-right',
  arrow_back: 'arrow-left',
  arrow_forward: 'arrow-right',
  expand_more: 'chevron-down',
  expand_less: 'chevron-up',
  first_page: 'chevron-double-left',
  last_page: 'chevron-double-right',

  // Actions
  add: 'plus-lg',
  edit: 'pencil',
  delete: 'trash',
  search: 'search',
  save: 'floppy',
  refresh: 'arrow-clockwise',
  sync: 'arrow-repeat',
  logout: 'box-arrow-right',
  check_circle: 'check-circle-fill',
  check: 'check-lg',
  block: 'slash-circle',
  clear: 'x-circle',
  restart_alt: 'arrow-clockwise',
  link: 'link-45deg',
  link_off: 'link',
  person_add: 'person-plus',
  download: 'download',
  upload: 'upload',
  cloud_upload: 'cloud-upload',
  file_download: 'file-earmark-arrow-down',
  content_copy: 'clipboard',
  filter_list: 'funnel',
  sort: 'sort-alpha-down',
  swap_horiz: 'arrow-left-right',

  // Content / Features
  people: 'people',
  people_outline: 'people',
  person: 'person',
  campaign: 'megaphone',
  public: 'globe',
  history: 'clock-history',
  assignment: 'clipboard-check',
  ads_click: 'cursor',
  notifications: 'bell',
  notifications_active: 'bell-fill',
  notifications_none: 'bell',
  emoji_events: 'trophy',
  military_tech: 'award',
  edit_note: 'pencil-square',
  date_range: 'calendar-range',
  view_list: 'list-ul',
  insights: 'graph-up',
  merge_type: 'diagram-3',
  compare: 'arrow-left-right',
  autorenew: 'arrow-repeat',
  photo_library: 'images',
  image: 'image',
  account_circle: 'person-circle',
  settings: 'gear',
  help: 'question-circle',
  info: 'info-circle-fill',
  home: 'house',
  email: 'envelope',
  lock: 'lock',
  lock_open: 'unlock',
  tag: 'hash',
  label: 'tag',
  folder: 'folder',
  folder_open: 'folder2-open',

  // Status / Indicators
  error: 'exclamation-circle-fill',
  error_outline: 'exclamation-circle',
  warning: 'exclamation-triangle-fill',
  warning_amber: 'exclamation-triangle',
  check_circle_outline: 'check-circle',
  cancel: 'x-circle-fill',
  verified: 'patch-check-fill',
  shield: 'shield-check',
  schedule: 'clock',

  // Data / Charts
  trending_up: 'graph-up-arrow',
  trending_down: 'graph-down-arrow',
  trending_flat: 'dash-lg',
  bar_chart: 'bar-chart',
  table_chart: 'table',
  leaderboard: 'bar-chart-steps',
  show_chart: 'graph-up',
  pie_chart: 'pie-chart',
  analytics: 'bar-chart-line',
  account_balance_wallet: 'wallet2',
  account_balance: 'bank',
  savings: 'piggy-bank',
  receipt_long: 'receipt',
  payments: 'credit-card',
  attach_money: 'currency-dollar',
  money: 'cash-stack',
  speed: 'speedometer',

  // UI
  visibility: 'eye',
  visibility_off: 'eye-slash',
  more_vert: 'three-dots-vertical',
  more_horiz: 'three-dots',
  badge: 'person-badge',
  today: 'calendar-day',
  calendar_month: 'calendar-month',
  calendar_today: 'calendar-event',
  child_care: 'emoji-smile',
  group: 'people-fill',
  group_off: 'people',
  groups: 'people-fill',
  star: 'star-fill',
  star_outline: 'star',
  favorite: 'heart-fill',
  thumb_up: 'hand-thumbs-up',
  thumb_down: 'hand-thumbs-down',
  search_off: 'search',
  photo_camera: 'camera',
  inventory: 'box-seam',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<i [class]="'bi bi-' + mappedName + ' ' + sizeClass" aria-hidden="true"></i>`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .icon-sm { font-size: 16px; }
      .icon-md { font-size: 20px; }
      .icon-lg { font-size: 24px; }
      .icon-xl { font-size: 32px; }
    `,
  ],
})
export class IconComponent {
  @Input() name = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

  get mappedName(): string {
    return ICON_MAP[this.name] || this.name;
  }

  get sizeClass(): string {
    return `icon-${this.size}`;
  }
}
