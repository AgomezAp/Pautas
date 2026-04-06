import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (imageUrl) {
      <img [src]="imageUrl" [alt]="name" class="avatar" [style.width.px]="size" [style.height.px]="size" />
    } @else {
      <span class="avatar avatar--initials" [style.width.px]="size" [style.height.px]="size"
            [style.fontSize.px]="size * 0.4">
        {{ initials }}
      </span>
    }
  `,
  styles: [`
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-full);
      object-fit: cover;
      flex-shrink: 0;
    }
    .avatar--initials {
      background: var(--brand-accent);
      color: var(--brand-primary);
      font-weight: var(--weight-bold);
      letter-spacing: -0.02em;
      text-transform: uppercase;
      user-select: none;
    }
  `]
})
export class AvatarComponent {
  @Input() name = '';
  @Input() imageUrl: string | null = null;
  @Input() size = 32;

  get initials(): string {
    if (!this.name) return '?';
    const parts = this.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return parts[0].substring(0, 2);
  }
}
