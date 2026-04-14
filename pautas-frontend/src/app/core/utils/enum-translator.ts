/**
 * Enum mapping utilities for Google Ads API values
 * Frontend-side translation of Google Ads enum codes to human-readable labels
 */

export class EnumTranslator {
  static mapAge(value: string | number): string {
    const ageMapping: { [key: string]: string } = {
      '503001': '18-24',
      '503002': '25-34',
      '503003': '35-44',
      '503004': '45-54',
      '503005': '55-64',
      '503006': '65+',
      '503999': 'Undetermined',
      'AGE_RANGE_503001': '18-24',
      'AGE_RANGE_503002': '25-34',
      'AGE_RANGE_503003': '35-44',
      'AGE_RANGE_503004': '45-54',
      'AGE_RANGE_503005': '55-64',
      'AGE_RANGE_503006': '65+',
      'AGE_RANGE_503999': 'Undetermined',
    };
    return ageMapping[String(value)] || String(value);
  }

  static mapGender(value: string | number): string {
    const genderMapping: { [key: string]: string } = {
      '10': 'Male',
      '11': 'Female',
      '20': 'Undetermined',
      'MALE': 'Male',
      'FEMALE': 'Female',
      'UNDETERMINED': 'Undetermined',
    };
    return genderMapping[String(value)] || String(value);
  }

  static mapDevice(value: string | number): string {
    const deviceMapping: { [key: string]: string } = {
      '1': 'Mobile',
      '2': 'Desktop',
      '3': 'Tablet',
      '4': 'Connected TV',
      'MOBILE': 'Mobile',
      'DESKTOP': 'Desktop',
      'TABLET': 'Tablet',
      'CONNECTED_TV': 'Connected TV',
    };
    return deviceMapping[String(value)] || String(value);
  }

  static mapMatchType(value: string | number): string {
    const matchTypeMapping: { [key: string]: string } = {
      '1': 'Exact',
      '2': 'Phrase',
      '3': 'Broad',
      '4': 'Broad Match Modifier',
      'EXACT': 'Exact',
      'PHRASE': 'Phrase',
      'BROAD': 'Broad',
      'BROAD_MATCH_MODIFIER': 'Broad Match Modifier',
    };
    return matchTypeMapping[String(value)] || String(value);
  }

  static mapAdType(value: string | number): string {
    const adTypeMapping: { [key: string]: string } = {
      '1': 'Expanded Text Ad',
      '2': 'Text Ad',
      '3': 'Responsive Search Ad',
      '7': 'Responsive Display Ad',
      '15': 'Video Ad',
      '42': 'Native App Ad',
      'EXPANDED_TEXT_AD': 'Expanded Text Ad',
      'TEXT_AD': 'Text Ad',
      'RESPONSIVE_SEARCH_AD': 'Responsive Search Ad',
      'IMAGE_AD': 'Image Ad',
      'VIDEO_AD': 'Video Ad',
      'RESPONSIVE_DISPLAY_AD': 'Responsive Display Ad',
      'NATIVE_APP_AD': 'Native App Ad',
      'SHOPPING_PRODUCT_AD': 'Shopping Product Ad',
      'SMART_SHOPPING_AD': 'Smart Shopping Ad',
    };
    return adTypeMapping[String(value)] || String(value);
  }
}
