import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [attr.width]="width" [attr.height]="height" [attr.viewBox]="'0 0 ' + width + ' ' + height"
         class="sparkline" preserveAspectRatio="none">
      @if (areaPath) {
        <path [attr.d]="areaPath" [attr.fill]="color + '18'" />
      }
      @if (linePath) {
        <path [attr.d]="linePath" fill="none" [attr.stroke]="color" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" />
      }
      @if (lastPoint) {
        <circle [attr.cx]="lastPoint.x" [attr.cy]="lastPoint.y" r="2.5" [attr.fill]="color" />
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    .sparkline { display: block; }
  `]
})
export class SparklineComponent implements OnChanges {
  @Input() data: number[] = [];
  @Input() width = 80;
  @Input() height = 24;
  @Input() color = 'var(--success)';

  linePath = '';
  areaPath = '';
  lastPoint: { x: number; y: number } | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['width'] || changes['height']) {
      this.buildPaths();
    }
  }

  private buildPaths(): void {
    if (!this.data || this.data.length < 2) {
      this.linePath = '';
      this.areaPath = '';
      this.lastPoint = null;
      return;
    }

    const padding = 3;
    const w = this.width - padding * 2;
    const h = this.height - padding * 2;
    const min = Math.min(...this.data);
    const max = Math.max(...this.data);
    const range = max - min || 1;

    const points = this.data.map((v, i) => ({
      x: padding + (i / (this.data.length - 1)) * w,
      y: padding + h - ((v - min) / range) * h,
    }));

    const lineSegments = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
    this.linePath = lineSegments;
    this.areaPath = `${lineSegments} L${points[points.length - 1].x},${this.height} L${points[0].x},${this.height} Z`;
    this.lastPoint = points[points.length - 1];
  }
}
