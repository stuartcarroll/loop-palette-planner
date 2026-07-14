// Renders the export / can-list screen to a ~1080px-wide PNG. Fonts are awaited
// before any text is painted so the PNG is never drawn with fallback glyphs.
import { flatColours, totalCans, colourCount } from '/store.js';
import { VENDORS } from '/data/vendors.js';

const W = 1080;
const M = 64;                 // outer margin
const CW = W - M * 2;         // content width
const GROTESK = "'Space Grotesk'";
const SANS = "'Instrument Sans'";
const MONO = "'Space Mono'";

async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`600 40px ${GROTESK}`),
      document.fonts.load(`700 40px ${GROTESK}`),
      document.fonts.load(`600 34px ${SANS}`),
      document.fonts.load(`700 26px ${MONO}`),
      document.fonts.load(`400 26px ${MONO}`),
    ]);
    await document.fonts.ready;
  } catch {}
}

export function brandForState(s) {
  const vendors = new Set(flatColours(s).map((c) => c.vendor));
  if (vendors.size === 1) {
    const v = VENDORS.find((x) => x.id === [...vendors][0]);
    return v ? v.brand : 'Mixed';
  }
  return vendors.size === 0 ? '' : 'Mixed';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

export async function renderExportCanvas(s) {
  await ensureFonts();
  const items = flatColours(s);
  const barsH = 300;
  const footH = 118;
  const cardH = barsH + footH;
  const listHeadY = M + cardH + 56;
  const rowH = 96;
  const listH = items.length * rowH;
  const totalH = listHeadY + 34 + listH + 90 + 70; // header + rows + total + footer
  const cssH = Math.max(totalH, 900);

  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // background
  ctx.fillStyle = '#17181A';
  ctx.fillRect(0, 0, W, cssH);

  // ---- preview card ----
  ctx.save();
  roundRect(ctx, M, M, CW, cardH, 26);
  ctx.clip();
  // colour bars
  if (items.length) {
    const bw = CW / items.length;
    items.forEach((c, i) => {
      ctx.fillStyle = c.hex;
      ctx.fillRect(M + i * bw, M, Math.ceil(bw) + 1, barsH);
    });
  } else {
    ctx.fillStyle = '#26282B';
    ctx.fillRect(M, M, CW, barsH);
  }
  // foot strip
  ctx.fillStyle = '#1D1E20';
  ctx.fillRect(M, M + barsH, CW, footH);
  ctx.restore();
  // card border
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  roundRect(ctx, M + 0.5, M + 0.5, CW - 1, cardH - 1, 26);
  ctx.stroke();

  // foot text
  const footY = M + barsH;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#EDEDEC';
  ctx.font = `600 38px ${GROTESK}`;
  const name = (s.pieceName || '').trim() || 'Untitled piece';
  ctx.fillText(ellipsize(ctx, name, CW - 260), M + 32, footY + 52);
  ctx.fillStyle = '#7C7E81';
  ctx.font = `400 26px ${MONO}`;
  ctx.fillText(`${colourCount(s)} colours · ${totalCans(s)} cans`, M + 32, footY + 90);
  // brand tag
  const brand = brandForState(s);
  if (brand) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#C7F464';
    ctx.font = `700 30px ${GROTESK}`;
    ctx.fillText(brand, M + CW - 32, footY + 72);
    ctx.textAlign = 'left';
  }

  // ---- shopping list ----
  ctx.fillStyle = '#6C6E71';
  ctx.font = `700 24px ${MONO}`;
  ctx.fillText('SHOPPING LIST', M, listHeadY);

  let y = listHeadY + 40;
  for (const c of items) {
    // swatch
    ctx.fillStyle = c.hex;
    roundRect(ctx, M, y, 64, 64, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    roundRect(ctx, M + 0.5, y + 0.5, 63, 63, 14);
    ctx.stroke();
    // name + sub
    ctx.textAlign = 'left';
    ctx.fillStyle = '#EDEDEC';
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText(ellipsize(ctx, c.name, CW - 120 - 120), M + 92, y + 30);
    ctx.fillStyle = '#8A8C8F';
    ctx.font = `400 24px ${MONO}`;
    ctx.fillText(`${c.code} · ${c.role}`, M + 92, y + 58);
    // qty
    ctx.textAlign = 'right';
    ctx.fillStyle = '#EDEDEC';
    ctx.font = `700 32px ${MONO}`;
    ctx.fillText(`×${c.qty}`, M + CW, y + 46);
    ctx.textAlign = 'left';
    y += rowH;
  }

  // ---- total ----
  y += 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(M + CW, y);
  ctx.stroke();
  y += 46;
  ctx.fillStyle = '#EDEDEC';
  ctx.font = `600 32px ${GROTESK}`;
  ctx.fillText('Total', M, y);
  ctx.textAlign = 'right';
  ctx.font = `700 32px ${GROTESK}`;
  ctx.fillText(`${totalCans(s)} cans`, M + CW, y);
  ctx.textAlign = 'left';

  // ---- footer ----
  ctx.fillStyle = '#5A5C5F';
  ctx.font = `400 24px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('colours.stuc.dev', W / 2, cssH - 40);

  return canvas;
}
