import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sync-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sync-indicator.component.html',
  styleUrl: './sync-indicator.component.scss',
})
export class SyncIndicatorComponent {
  @Input() syncing = false;
  @Input() label = 'Sincronizado';
}
