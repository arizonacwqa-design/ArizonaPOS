import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

if (!fs.existsSync(envPath)) {
  console.warn(
    '\n⚠  No .env file found. Copy .env.example → .env before building the installer.\n' +
      '   The packaged app will not connect to Supabase without VITE_* variables at build time.\n'
  );
  process.exit(0);
}

const text = fs.readFileSync(envPath, 'utf8');
const values = Object.fromEntries(
  text
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const missing = required.filter((key) => !values[key] || values[key].includes('your-'));

if (missing.length) {
  console.warn(
    `\n⚠  .env is missing or still has placeholders for: ${missing.join(', ')}\n` +
      '   Fix these before npm run dist so credentials are baked into the installer.\n'
  );
} else {
  console.log('✓ .env looks ready for production build.');
}
