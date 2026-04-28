import Constants from 'expo-constants';

/**
 * URL базового API Suitcase.
 * Настраивается через app.json → expo.extra.apiUrl
 * или через переменные окружения EXPO_PUBLIC_API_URL.
 */
export const ApiBaseUrl: string =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl?.toString() ||
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  'https://api.crista.online/suitcase-api';

export const GoogleMapsApiKey = 'AIzaSyAgYFJS60ZmSmhCUaKhR7xzFkcIWtey1cM';

export const DaDataApiKey = '0759132d01d133f630bc606c7456843fcac55d40';
export const DaDataSecret = 'f65da99ef583f2c1fd6662c24513b3a0bd168fb9';
