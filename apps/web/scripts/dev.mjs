import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = path.join(webDir, '../..');

loadEnvConfig(monorepoRoot);
loadEnvConfig(webDir);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '\n[web:dev] SUPABASE_SERVICE_ROLE_KEY is missing from .env — Google admin allowlist checks will fail.\n' +
      '         Add it from Supabase Dashboard → Settings → API → service_role (secret).\n',
  );
}

const child = spawn('npx', ['next', 'dev', '--port', '3001'], {
  cwd: webDir,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
