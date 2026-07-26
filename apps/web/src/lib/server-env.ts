import path from 'node:path';
import { loadEnvConfig } from '@next/env';

let loaded = false;

/** Load monorepo root + apps/web env files on the server (API routes). */
export const ensureServerEnv = (): void => {
  if (loaded) return;

  const webDir = process.cwd();
  const monorepoRoot = path.join(webDir, '../..');

  loadEnvConfig(monorepoRoot);
  loadEnvConfig(webDir);

  // Do not assign to process.env.NEXT_PUBLIC_* — Next inlines those as literals at build time.
  // Fallbacks are applied in getServerSupabaseEnv() when reading.

  loaded = true;
};

export const getServerSupabaseEnv = () => {
  ensureServerEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return { url, anonKey, serviceRoleKey, missing };
};
