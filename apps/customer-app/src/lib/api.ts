import Constants from 'expo-constants';

/**
 * Base URL for the Next.js API (apps/web).
 * Prefer EXPO_PUBLIC_API_URL; otherwise derive host from Expo debugger (LAN).
 */
export const getApiBaseUrl = (): string => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri?.replace(/^\w+:\/\//, '');

  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:3001`;
  }

  return 'http://localhost:3001';
};
