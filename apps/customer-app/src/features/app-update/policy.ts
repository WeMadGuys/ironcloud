import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '../../lib/supabase';
import { isOlderThan } from './version';

export type UpdatePolicy = {
  title: string;
  message: string;
  storeUrl: string;
};

export type UpdateCheck = {
  required: boolean;
  policy: UpdatePolicy | null;
};

export function installedAppVersion(): string {
  const fromConfig = Constants.expoConfig?.version?.trim();
  if (fromConfig) return fromConfig;
  const nativeVersion = Constants.nativeAppVersion?.trim();
  return nativeVersion || '0.0.0';
}

/**
 * Ask the server whether this install is too old to use.
 * Missing policy, offline, or a query error leaves the app usable.
 */
export async function checkRequiredUpdate(): Promise<UpdateCheck> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { required: false, policy: null };
  }

  const { data, error } = await supabase
    .from('app_version_policy')
    .select('min_version, store_url, title, message')
    .eq('platform', Platform.OS)
    .maybeSingle();

  if (error || !data?.min_version || !data.store_url) {
    return { required: false, policy: null };
  }

  const policy: UpdatePolicy = {
    title: data.title?.trim() || 'Update required',
    message:
      data.message?.trim() ||
      'A new version of IronCloud is ready. Update the app to continue.',
    storeUrl: data.store_url.trim(),
  };

  return {
    required: isOlderThan(installedAppVersion(), data.min_version),
    policy,
  };
}
