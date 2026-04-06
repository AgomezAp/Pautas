import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'compactNumber', standalone: true })
export class CompactNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 1): string {
    if (value == null) return '—';
    if (Math.abs(value) < 1000) return value.toLocaleString('es-CO');
    const units = ['K', 'M', 'B'];
    let idx = -1;
    let v = Math.abs(value);
    while (v >= 1000 && idx < units.length - 1) {
      v /= 1000;
      idx++;
    }
    const sign = value < 0 ? '-' : '';
    return sign + v.toFixed(decimals).replace(/\.0+$/, '') + units[idx];
  }
}
