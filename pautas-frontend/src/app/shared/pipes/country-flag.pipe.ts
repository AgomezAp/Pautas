import { Pipe, PipeTransform } from '@angular/core';

const FLAGS: Record<string, string> = {
  colombia: '🇨🇴',
  peru: '🇵🇪',
  chile: '🇨🇱',
  ecuador: '🇪🇨',
  mexico: '🇲🇽',
  panama: '🇵🇦',
  bolivia: '🇧🇴',
  españa: '🇪🇸',
  espana: '🇪🇸',
};

@Pipe({ name: 'countryFlag', standalone: true })
export class CountryFlagPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return FLAGS[value.toLowerCase()] || '';
  }
}
