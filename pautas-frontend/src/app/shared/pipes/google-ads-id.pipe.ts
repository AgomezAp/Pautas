import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'googleAdsId', standalone: true })
export class GoogleAdsIdPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const clean = value.replace(/\D/g, '');
    if (clean.length === 10) {
      return clean.slice(0, 3) + '-' + clean.slice(3, 6) + '-' + clean.slice(6);
    }
    return value;
  }
}
