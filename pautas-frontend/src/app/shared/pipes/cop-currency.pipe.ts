import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'copCurrency', standalone: true })
export class CopCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, showSymbol = true): string {
    if (value == null) return '—';
    const formatted = value.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return showSymbol ? `$${formatted}` : formatted;
  }
}
