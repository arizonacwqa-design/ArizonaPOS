import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const localOut = path.join(
  process.env.LOCALAPPDATA || path.join(root, 'AppData', 'Local'),
  'ArizonaPOS',
  'release'
);

if (process.platform === 'win32') {
  for (const name of ['Arizona Car World', 'electron', 'Electron']) {
    try {
      execSync(`taskkill /F /IM "${name}.exe" /T 2>nul`, { stdio: 'ignore' });
    } catch {
      // not running
    }
  }
}

try {
  fs.rmSync(localOut, { recursive: true, force: true });
} catch {
  console.warn(
    `\nCould not clear ${localOut} (file in use). Close Arizona Car World / Electron, then rebuild.\n`
  );
}
