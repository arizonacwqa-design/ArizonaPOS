import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to Vite build index.html (works in dev tree and inside app.asar). */
export function getDistIndexPath() {
  const candidates = [
    path.join(app.getAppPath(), 'app', 'index.html'),
    path.join(__dirname, '..', 'app', 'index.html'),
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

export function getPreloadPath() {
  return path.join(__dirname, 'preload.cjs');
}
