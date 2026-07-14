// Generate PWA icons + favicon from an inline SVG: the "Palette" brand mark —
// a lime ring on the near-black app background. Rasterized with sharp.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(outDir, { recursive: true });

function svg({ size, maskable }) {
  const pad = maskable ? size * 0.16 : size * 0.05;
  const cx = size / 2, cy = size / 2;
  const outerR = (size - pad * 2) / 2;
  const stroke = outerR * 0.135; // proportional ring like the 26px/2.5px app mark
  const r = outerR - stroke / 2 - size * 0.06;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0E0F10"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#C7F464" stroke-width="${stroke}"/>
</svg>`;
}

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'favicon-32.png', size: 32, maskable: false },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t))).png().toFile(outDir + t.name);
  console.log('wrote', t.name);
}
writeFileSync(outDir + 'icon.svg', svg({ size: 512, maskable: false }));
console.log('wrote icon.svg');
