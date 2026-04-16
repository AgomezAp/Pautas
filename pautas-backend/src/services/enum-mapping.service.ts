/**
 * Google Ads API Enum Mapping Service
 * Converts raw enum codes from Google Ads API to human-readable labels
 * Shared between backend (SQL) and frontend display logic
 */

export class EnumMappingService {
  /**
   * Age range demographic values
   * Maps Google's canonical name format to readable labels
   */
  static mapAgeRange(value: string | number): string {
    const ageMapping: { [key: string]: string } = {
      // Numeric codes
      '503001': '18-24',
      '503002': '25-34',
      '503003': '35-44',
      '503004': '45-54',
      '503005': '55-64',
      '503006': '65+',
      '503999': 'Undetermined',
      // String format alternatives
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

  /**
   * Gender demographic values
   */
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

  /**
   * Device type values
   */
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

  /**
   * Keyword match type values
   */
  static mapMatchType(value: string | number): string {
    const matchTypeMapping: { [key: string]: string } = {
      '1': 'Exacta',
      '2': 'Frase',
      '3': 'Amplia',
      '4': 'Amplia Modificada',
      'EXACT': 'Exacta',
      'PHRASE': 'Frase',
      'BROAD': 'Amplia',
      'BROAD_MATCH_MODIFIER': 'Amplia Modificada',
    };
    return matchTypeMapping[String(value)] || String(value);
  }

  /**
   * Ad type values from Google Ads API
   */
  static mapAdType(value: string | number): string {
    const adTypeMapping: { [key: string]: string } = {
      // Numeric variants
      '1': 'Expanded Text Ad',
      '2': 'Text Ad',
      '3': 'Responsive Search Ad',
      '7': 'Responsive Display Ad',
      '15': 'Video Ad',
      '42': 'Native App Ad',
      // String variants
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

  /**
   * Generates SQL CASE statement for age range mapping
   */
  static getAgeCaseSQL(fieldName: string = 'demographic_value'): string {
    return `
      CASE
        WHEN ${fieldName} = '503001' THEN '18-24'
        WHEN ${fieldName} = '503002' THEN '25-34'
        WHEN ${fieldName} = '503003' THEN '35-44'
        WHEN ${fieldName} = '503004' THEN '45-54'
        WHEN ${fieldName} = '503005' THEN '55-64'
        WHEN ${fieldName} = '503006' THEN '65+'
        WHEN ${fieldName} = '503999' THEN 'Undetermined'
        ELSE ${fieldName}
      END`;
  }

  /**
   * Generates SQL CASE statement for gender mapping
   */
  static getGenderCaseSQL(fieldName: string = 'demographic_value'): string {
    return `
      CASE
        WHEN ${fieldName} = '10' THEN 'Male'
        WHEN ${fieldName} = '11' THEN 'Female'
        WHEN ${fieldName} = '20' THEN 'Undetermined'
        ELSE ${fieldName}
      END`;
  }

  /**
   * Generates SQL CASE statement for device mapping
   */
  static getDeviceCaseSQL(fieldName: string = 'device'): string {
    return `
      CASE
        WHEN ${fieldName}::text = '1' OR ${fieldName} = 'MOBILE' THEN 'Mobile'
        WHEN ${fieldName}::text = '2' OR ${fieldName} = 'DESKTOP' THEN 'Desktop'
        WHEN ${fieldName}::text = '3' OR ${fieldName} = 'TABLET' THEN 'Tablet'
        WHEN ${fieldName}::text = '4' OR ${fieldName} = 'CONNECTED_TV' THEN 'Connected TV'
        ELSE ${fieldName}::text
      END`;
  }

  /**
   * Generates SQL CASE statement for match type mapping
   */
  static getMatchTypeCaseSQL(fieldName: string = 'match_type'): string {
    return `
      CASE
        WHEN ${fieldName}::text = '1' OR ${fieldName} = 'EXACT' THEN 'Exacta'
        WHEN ${fieldName}::text = '2' OR ${fieldName} = 'PHRASE' THEN 'Frase'
        WHEN ${fieldName}::text = '3' OR ${fieldName} = 'BROAD' THEN 'Amplia'
        WHEN ${fieldName}::text = '4' OR ${fieldName} = 'BROAD_MATCH_MODIFIER' THEN 'Amplia Modificada'
        ELSE ${fieldName}::text
      END`;
  }

  /**
   * Generates SQL CASE statement for ad type mapping
   */
  static getAdTypeCaseSQL(fieldName: string = 'ad_type'): string {
    return `
      CASE
        WHEN ${fieldName} = '1' OR ${fieldName} = 'EXPANDED_TEXT_AD' THEN 'Expanded Text Ad'
        WHEN ${fieldName} = '2' OR ${fieldName} = 'TEXT_AD' THEN 'Text Ad'
        WHEN ${fieldName} = '3' OR ${fieldName} = 'RESPONSIVE_SEARCH_AD' THEN 'Responsive Search Ad'
        WHEN ${fieldName} = '7' OR ${fieldName} = 'RESPONSIVE_DISPLAY_AD' THEN 'Responsive Display Ad'
        WHEN ${fieldName} = '15' OR ${fieldName} = 'VIDEO_AD' THEN 'Video Ad'
        WHEN ${fieldName} = '42' OR ${fieldName} = 'NATIVE_APP_AD' THEN 'Native App Ad'
        WHEN ${fieldName} = 'IMAGE_AD' THEN 'Image Ad'
        WHEN ${fieldName} = 'SHOPPING_PRODUCT_AD' THEN 'Shopping Product Ad'
        WHEN ${fieldName} = 'SMART_SHOPPING_AD' THEN 'Smart Shopping Ad'
        ELSE ${fieldName}
      END`;
  }
}
