import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from './core/services/loading.service';
import { CommonModule } from '@angular/common';
import { ToastContainerComponent } from './shared/components/toast/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, ToastContainerComponent],
  template: `
    @if (loadingService.isLoading()) {
      <div class="progress global-loading">
        <div class="progress-bar progress-bar-striped progress-bar-animated w-100"></div>
      </div>
    }
    <router-outlet />
    <app-toast-container />
  `,
  styles: [``]
})
export class App {
  constructor(public loadingService: LoadingService) {}
}
