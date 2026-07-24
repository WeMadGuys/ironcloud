import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(webDir, '../..');

// Load root .env first (shared with Expo apps), then apps/web/.env.local overrides
loadEnvConfig(monorepoRoot);
loadEnvConfig(webDir);

// Re-use Expo app credentials when Next-specific vars are not set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  transpilePackages: ['@ironcloud/ui', '@ironcloud/db', '@ironcloud/api'],
  experimental: {
    optimizePackageImports: ['@mdi/react', 'recharts'],
  },
};

export default nextConfig;
