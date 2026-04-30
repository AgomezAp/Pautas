import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, filter, switchMap } from 'rxjs/operators';
import { API_URLS } from '../../../core/constants/api-urls';

interface Campaign {
  id: number;
  name: string;
  country: string;
}

interface CampaignReport {
  id: number;
  campaign_name: string;
  description: string;
  sent_at: string;
  created_at: string;
}

@Component({
  selector: 'app-pautador-campaign-reports',
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-reports.component.html',
  styleUrl: './campaign-reports.component.scss',
})
export class PautadorCampaignReportsComponent implements OnInit, OnDestroy {
  campaigns: Campaign[] = [];
  reports: CampaignReport[] = [];

  selectedCampaignId: number | null = null;
  description = '';

  sending = false;
  sent = false;
  errorMsg = '';

  /** Milliseconds until auto-send */
  readonly DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
  /** How often to update the countdown UI (ms) */
  private readonly TICK_MS = 1000;

  countdownSeconds = 0;
  private debounceSubject = new Subject<{ campaignId: number; description: string }>();
  private tickInterval?: ReturnType<typeof setInterval>;
  private lastTypedAt: number | null = null;
  private subs = new Subscription();

  constructor(private http: HttpClient, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCampaigns();
    this.loadReports();

    const debounceSub = this.debounceSubject.pipe(
      filter(v => !!v.campaignId && v.description.trim().length > 0),
      debounceTime(this.DEBOUNCE_MS),
      switchMap(v => {
        this.sending = true;
        return this.http.post(API_URLS.campaignReports.create, {
          campaignId: v.campaignId,
          description: v.description,
        });
      })
    ).subscribe({
      next: () => {
        this.sending = false;
        this.sent = true;
        this.description = '';
        this.selectedCampaignId = null;
        this.countdownSeconds = 0;
        this.stopTick();
        this.loadReports();
        setTimeout(() => this.sent = false, 4000);
      },
      error: (err) => {
        this.sending = false;
        this.errorMsg = err?.error?.message || 'Error al enviar el reporte.';
        setTimeout(() => this.errorMsg = '', 5000);
      }
    });
    this.subs.add(debounceSub);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.stopTick();
  }

  loadCampaigns(): void {
    this.http.get<any>(API_URLS.campaignReports.campaigns).subscribe({
      next: res => this.campaigns = res.data || [],
      error: () => {}
    });
  }

  loadReports(): void {
    this.http.get<any>(API_URLS.campaignReports.list).subscribe({
      next: res => this.reports = res.data || [],
      error: () => {}
    });
  }

  onDescriptionChange(): void {
    if (!this.selectedCampaignId || !this.description.trim()) {
      this.stopTick();
      this.countdownSeconds = 0;
      return;
    }
    this.lastTypedAt = Date.now();
    this.countdownSeconds = Math.ceil(this.DEBOUNCE_MS / 1000);
    this.startTick();
    this.debounceSubject.next({
      campaignId: this.selectedCampaignId,
      description: this.description,
    });
  }

  sendNow(): void {
    if (!this.selectedCampaignId || !this.description.trim()) return;
    this.stopTick();
    this.countdownSeconds = 0;
    this.sending = true;
    this.http.post(API_URLS.campaignReports.create, {
      campaignId: this.selectedCampaignId,
      description: this.description,
    }).subscribe({
      next: () => {
        this.sending = false;
        this.sent = true;
        this.description = '';
        this.selectedCampaignId = null;
        this.debounceSubject.next({ campaignId: 0, description: '' }); // reset debounce
        this.loadReports();
        setTimeout(() => this.sent = false, 4000);
      },
      error: (err) => {
        this.sending = false;
        this.errorMsg = err?.error?.message || 'Error al enviar el reporte.';
        setTimeout(() => this.errorMsg = '', 5000);
      }
    });
  }

  cancelPending(): void {
    this.stopTick();
    this.countdownSeconds = 0;
    this.description = '';
    this.selectedCampaignId = null;
    // Emit empty to reset debounce pipeline
    this.debounceSubject.next({ campaignId: 0, description: '' });
  }

  get countdownLabel(): string {
    const m = Math.floor(this.countdownSeconds / 60);
    const s = this.countdownSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private startTick(): void {
    this.stopTick();
    // Run outside Angular zone to avoid triggering CD on every tick
    this.ngZone.runOutsideAngular(() => {
      this.tickInterval = setInterval(() => {
        if (this.lastTypedAt === null) return;
        const elapsed = (Date.now() - this.lastTypedAt) / 1000;
        const remaining = Math.ceil(this.DEBOUNCE_MS / 1000 - elapsed);
        const next = Math.max(0, remaining);
        if (next !== this.countdownSeconds) {
          // Re-enter Angular zone only when value actually changes
          this.ngZone.run(() => {
            this.countdownSeconds = next;
            this.cdr.markForCheck();
          });
        }
        if (next === 0) this.stopTick();
      }, this.TICK_MS);
    });
  }

  private stopTick(): void {
    if (this.tickInterval !== undefined) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }
}
