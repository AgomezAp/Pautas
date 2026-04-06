import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from './core/services/loading.service';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, MatProgressBarModule, ToastContainerComponent],
  template: `
    @if (loadingService.isLoading()) {
      <mat-progress-bar mode="indeterminate" class="global-loading"></mat-progress-bar>
    }
    <router-outlet />
    <app-toast-container />
  `,
  styles: [`
    .global-loading {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
    }
  `]
})
export class App {
  constructor(public loadingService: LoadingService) {}
}
