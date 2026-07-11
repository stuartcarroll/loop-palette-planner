// Generate PWA icons + favicon from an inline SVG (spray-cap ring + drip).
// Rasterized with sharp so there are no runtime deps and no binary blobs in git
// that we can't regenerate.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(outDir, { recursive: true });

// A bold graffiti "cap dot" mark: yellow ring on near-black, with a paint drip.
function svg({ size, maskable }) {
  const pad = maskable ? size * 0.14 : size * 0.06; // safe zone for maskable
  const cx = size / 2;
  const cy = size / 2;
  const outer = (size - pad * 2) / 2;
  const ring = outer * 0.30;
  const core = outer - ring;
  const dripW = outer * 0.42;
  const dripTop = cy + core * 0.55;
  const dripBot = cy + outer * 1.02;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="90%">
      <stop offset="0%" stop-color="#232323"/>
      <stop offset="100%" stop-color="#0c0c0c"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#bg)"/>
  <path d="M ${cx - dripW / 2} ${cy}
           Q ${cx - dripW / 2} ${dripTop} ${cx - dripW * 0.28} ${dripTop}
           L ${cx - dripW * 0.28} ${dripBot - dripW * 0.28}
           A ${dripW * 0.28} ${dripW * 0.28} 0 1 0 ${cx + dripW * 0.28} ${dripBot - dripW * 0.28}
           L ${cx + dripW * 0.28} ${dripTop}
           Q ${cx + dripW / 2} ${dripTop} ${cx + dripW / 2} ${cy} Z"
        fill="#ffd400"/>
  <circle cx="${cx}" cy="${cy}" r="${outer}" fill="none" stroke="#ffd400" stroke-width="${ring}"/>
  <circle cx="${cx}" cy="${cy}" r="${core * 0.72}" fill="#e53517"/>
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
  const buf = Buffer.from(svg(t));
  await sharp(buf).png().toFile(outDir + t.name);
  console.log('wrote', t.name);
}

// Also drop the raw source SVG for reference / <link rel=icon> scalable use.
writeFileSync(outDir + 'icon.svg', svg({ size: 512, maskable: false }));
console.log('wrote icon.svg');
