/**
 * Builds Windows icons from public/logo.svg for electron-builder.
 * Run: npm run icons
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'public', 'logo.svg');
const buildDir = path.join(root, 'build');

if (!fs.existsSync(svgPath)) {
  console.error('Missing public/logo.svg — add your logo first.');
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });

const icoSizes = [16, 32, 48, 64, 128, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(svgPath).resize(size, size).png().toBuffer())
);

const iconPng = await sharp(svgPath).resize(512, 512).png().toBuffer();
fs.writeFileSync(path.join(buildDir, 'icon.png'), iconPng);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), await pngToIco(icoBuffers));

console.log('Created build/icon.png (512x512) and build/icon.ico');
