import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Calendar version + deploy stamp in Europe/Paris at build time. */
function buildVersionMeta() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  const d = parts.find((p) => p.type === 'day')?.value ?? '00';
  const version = `${y}.${m}.${d}`;

  const fullSha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  const sha = fullSha ? fullSha.slice(0, 7) : 'dev';

  return {
    version,
    sha,
    deployedAt: now.toISOString(),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const meta = buildVersionMeta();
  return {
    plugins: [tailwindcss(), react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      __APP_VERSION__: JSON.stringify(meta.version),
      __APP_BUILD_SHA__: JSON.stringify(meta.sha),
      __APP_DEPLOYED_AT__: JSON.stringify(meta.deployedAt),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
