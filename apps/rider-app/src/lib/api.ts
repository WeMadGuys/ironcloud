import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Base URL for the Next.js API (apps/web).
 * Prefer EXPO_PUBLIC_API_URL; on a physical device rewrite localhost → Metro LAN host.
 */
export const getApiBaseUrl = (): string => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri?.replace(/^\w+:\/\//, '');
  const debuggerHost = hostUri?.split(':')[0];
  const isLanHost = Boolean(
    debuggerHost &&
      debuggerHost !== 'localhost' &&
      debuggerHost !== '127.0.0.1' &&
      !debuggerHost.includes('exp.direct'),
  );

  // Physical device: localhost in .env points at the phone, not the PC.
  if (
    Platform.OS !== 'web' &&
    fromEnv &&
    (fromEnv.includes('://localhost') || fromEnv.includes('://127.0.0.1')) &&
    isLanHost
  ) {
    return `http://${debuggerHost}:3001`;
  }

  if (fromEnv) return fromEnv;

  if (isLanHost) return `http://${debuggerHost}:3001`;

  return 'http://localhost:3001';
};
