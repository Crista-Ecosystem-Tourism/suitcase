import Constants from 'expo-constants';

/**
 * URL базового API Suitcase.
 * Настраивается через app.json → expo.extra.apiUrl
 * или через переменные окружения EXPO_PUBLIC_API_URL.
 */
export const ApiBaseUrl: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl?.toString() ||
  'https://api.crista.online/suitcase-api';

/** Account/auth API is served by ai_agent, not by the Suitcase data service. */
export const IdentityApiBaseUrl: string =
  (process.env.EXPO_PUBLIC_IDENTITY_API_URL as string | undefined) ||
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.identityApiUrl?.toString() ||
  'https://crista.online/api';

export const GoogleMapsApiKey = 'AIzaSyAgYFJS60ZmSmhCUaKhR7xzFkcIWtey1cM';

export const DaDataApiKey = '0759132d01d133f630bc606c7456843fcac55d40';
export const DaDataSecret = 'f65da99ef583f2c1fd6662c24513b3a0bd168fb9';
