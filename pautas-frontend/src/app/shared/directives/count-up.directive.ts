import { Directive, ElementRef, Input, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';

@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('appCountUp') targetValue: number | string = 0;
  @Input() duration = 800;
  @Input() decimals = 0;

  private animationId: number | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetValue']) {
      this.animate();
    }
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private animate(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    const target = typeof this.targetValue === 'string'
      ? parseFloat(this.targetValue.replace(/[^0-9.-]/g, ''))
      : this.targetValue;

    if (isNaN(target)) {
      this.el.nativeElement.textContent = String(this.targetValue);
      return;
    }

    const start = 0;
    const startTime = performance.now();
    const duration = this.duration;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;

      this.el.nativeElement.textContent = current.toLocaleString('es-CO', {
        minimumFractionDigits: this.decimals,
        maximumFractionDigits: this.decimals,
      });

      if (progress < 1) {
        this.animationId = requestAnimationFrame(step);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(step);
  }
}
