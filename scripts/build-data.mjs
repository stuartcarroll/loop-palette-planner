// Build-time: parse each vendor's xlsx from data/ into a static per-vendor JS
// module under public/data/. Derives a colour `family` (for the picker's group
// headers + filter chips) from HSL at build time — the datasets have no family
// column. NO runtime fetch and NO runtime xlsx parsing: the app dynamically
// imports these generated modules.
import xlsx from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const outDir = fileURLToPath(new URL('../public/data/', import.meta.url));
mkdirSync(outDir, { recursive: true });

// Core Loop black/white cans missing from the sheet (which starts at LP-106).
const LOOP_MANUAL = [
  { code: 'LP-100', name: 'WHITE', hex: '#f7f7f2' },
  { code: 'LP-101', name: 'GLOSS WHITE', hex: '#ffffff' },
  { code: 'LP-103', name: 'BLACK MATT', hex: '#141414' },
  { code: 'LP-104', name: 'BLACK', hex: '#0a0a0a' },
  { code: 'LP-105', name: 'BLACK GLOSS', hex: '#000000' },
];

// Order defines the vendor-tab order. Loop is the default tab (first).
// Adding Montana WHITE / MTN Water Based later is a one-line addition here.
const VENDORS = [
  { id: 'loop', label: 'Loop Colors', brand: 'Loop', file: 'loop_colors', manual: LOOP_MANUAL, expect: 216 },
  { id: 'montana-gold', label: 'Montana GOLD', brand: 'Montana GOLD', file: 'montana_gold', expect: 193 },
  { id: 'montana-black', label: 'Montana BLACK', brand: 'Montana BLACK', file: 'montana_black', expect: 164 },
  { id: 'mtn-94', label: 'MTN 94', brand: 'MTN 94', file: 'mtn94', expect: 169 },
  { id: 'mtn-hardcore', label: 'MTN Hardcore', brand: 'MTN Hardcore', file: 'mtn_hardcore', expect: 139 },
  { id: 'molotow', label: 'Molotow PREMIUM', brand: 'Molotow', file: 'molotow_premium', expect: 163 },
  // Future one-liners:
  // { id: 'montana-white', label: 'Montana WHITE', brand: 'Montana WHITE', file: 'montana_white' },
  // { id: 'mtn-water', label: 'MTN Water Based', brand: 'MTN Water Based', file: 'mtn_water_based' },
];

// Ordered so the picker's family headers and chips read naturally.
export const FAMILY_ORDER = [
  'Yellow', 'Orange', 'Red', 'Pink', 'Purple', 'Blue', 'Green',
  'Brown', 'Metallic', 'Monochrome',
];

const normHex = (h) => {
  let s = String(h).trim();
  if (!s.startsWith('#')) s = '#' + s;
  return s.toLowerCase();
};

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.replace('#', '').padStart(6, '0').slice(0, 6)) || null;
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

// Derive a colour family from name + colour geometry. Name check catches
// metallics that hex alone can't (silver/copper look like greys/tans). Neutral
// detection uses raw chroma (max-min), not HSL saturation, which blows up near
// white/black and mis-buckets pale cans.
function familyOf(name, hex) {
  if (/\b(silver|chrome|copper|bronze|metallic|metal)\b/i.test(name)) return 'Metallic';

  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const chroma = (max - min) / 255;   // 0..1
  const l = (max + min) / 2 / 255;

  // Near-neutral (black / white / grey) all group under Monochrome.
  if (chroma < 0.10) return 'Monochrome';
  if (l <= 0.09) return 'Monochrome';

  const [h] = rgbToHsl(r, g, b);

  // Brown: warm hue, medium/low lightness, muted.
  if (h >= 15 && h <= 48 && l < 0.5 && chroma < 0.65) return 'Brown';
  if ((h < 15 || h >= 350) && l < 0.30) return 'Brown';

  // Hue buckets.
  if (h < 15 || h >= 345) return l > 0.72 ? 'Pink' : 'Red';
  if (h < 45) return 'Orange';
  if (h < 66) return 'Yellow';
  if (h < 160) return 'Green';
  if (h < 250) return 'Blue';
  if (h < 300) return 'Purple';
  return 'Pink'; // 300–345: magenta / pink
}

function readVendor(v) {
  const wb = xlsx.readFile(dataDir + v.file + '.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  const fromSheet = rows.map((r) => ({
    code: String(r['Product Code']).trim(),
    name: String(r['Color Name']).trim(),
    hex: normHex(r['HEX']),
  })).filter((c) => c.code && c.name && c.hex);

  const all = [...(v.manual || []), ...fromSheet];
  // attach rgb + family
  return all.map((c) => {
    const [r, g, b] = hexToRgb(c.hex);
    return { code: c.code, name: c.name, hex: c.hex, rgb: [r, g, b], family: familyOf(c.name, c.hex) };
  });
}

const hexRe = /^#[0-9a-f]{6}$/;
const manifest = [];
let hadError = false;

for (const v of VENDORS) {
  const colors = readVendor(v);
  // validate
  const errs = [];
  const seen = new Set();
  for (const c of colors) {
    if (!hexRe.test(c.hex)) errs.push(`${v.id}: bad hex ${c.code} ${c.hex}`);
    if (seen.has(c.code)) errs.push(`${v.id}: dup code ${c.code}`);
    seen.add(c.code);
  }
  if (v.expect && colors.length !== v.expect) {
    errs.push(`${v.id}: expected ${v.expect} colours, got ${colors.length}`);
  }
  if (errs.length) { hadError = true; console.error(errs.join('\n')); }

  const banner = `// AUTO-GENERATED by scripts/build-data.mjs — do not edit.\n`;
  writeFileSync(outDir + v.id + '.js', banner + `export const COLORS = ${JSON.stringify(colors)};\n`);

  // family distribution for eyeballing
  const dist = {};
  for (const c of colors) dist[c.family] = (dist[c.family] || 0) + 1;
  const distStr = FAMILY_ORDER.filter((f) => dist[f]).map((f) => `${f}:${dist[f]}`).join('  ');
  manifest.push({ id: v.id, label: v.label, brand: v.brand, count: colors.length });
  console.log(`${v.label.padEnd(18)} ${String(colors.length).padStart(3)}  ${distStr}`);
}

writeFileSync(
  outDir + 'vendors.js',
  `// AUTO-GENERATED by scripts/build-data.mjs — do not edit.\n` +
  `export const VENDORS = ${JSON.stringify(manifest)};\n` +
  `export const FAMILY_ORDER = ${JSON.stringify(FAMILY_ORDER)};\n`
);

console.log(`\nWrote ${manifest.length} vendor modules + vendors.js`);
if (hadError) { console.error('VALIDATION FAILED'); process.exit(1); }
