import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private loadingCount = signal(0);
  readonly isLoading = computed(() => this.loadingCount() > 0);

  show(): void {
    this.loadingCount.update(c => c + 1);
  }

  hide(): void {
    this.loadingCount.update(c => Math.max(0, c - 1));
  }
}
