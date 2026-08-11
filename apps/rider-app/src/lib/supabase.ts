import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { Database } from '@ironcloud/db';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Rider Supabase] Missing env vars. Create apps/rider-app/.env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart: npm run rider:start:clear',
  );
}

/**
 * Native: expo-secure-store. Web: localStorage (SecureStore is unreliable on web
 * and drops large auth sessions — which bounced riders back to login after OTP).
 */
const createAuthStorage = (): SupportedStorage => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key) => {
        try {
          if (typeof localStorage === 'undefined') return null;
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          if (typeof localStorage === 'undefined') return;
          localStorage.setItem(key, value);
        } catch {
          // Ignore quota / private mode errors
        }
      },
      removeItem: (key) => {
        try {
          if (typeof localStorage === 'undefined') return;
          localStorage.removeItem(key);
        } catch {
          // Ignore
        }
      },
    };
  }

  return {
    getItem: async (key) => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    setItem: async (key, value) => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // SecureStore can fail on certain devices / oversized values
      }
    },
    removeItem: async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore
      }
    },
  };
};

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: createAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export type { Database };
