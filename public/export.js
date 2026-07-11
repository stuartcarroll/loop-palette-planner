// Renders the palette to a 1080px-wide PNG canvas: dark concrete wall, marker
// title on yellow tape, then each element with its can circles labelled
// LP-code (bold) + colour name. Fonts are loaded before any text is painted.

const W = 1080;
const MARGIN = 64;
const CONTENT_W = W - MARGIN * 2;

const FONT_MARKER = "'Permanent Marker'";
const FONT_UI = "'Barlow Condensed'";

async function ensureFonts() {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`400 72px ${FONT_MARKER}`),
      document.fonts.load(`700 34px ${FONT_UI}`),
      document.fonts.load(`600 40px ${FONT_UI}`),
      document.fonts.load(`500 28px ${FONT_UI}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* if loading fails we still render with fallbacks */
  }
}

// Layout constants (device-pixel-independent; scaled by DPR at the end).
const TITLE_TOP = 70;
const TITLE_BLOCK = 210;
const EL_NAME_H = 74;
const CHIP_H = 132;      // one can chip (circle + 2 text lines)
const CHIP_COLS = 2;
const EL_GAP = 34;
const CIRCLE_R = 46;
const FOOTER_H = 92;

function chipRows(nCans) {
  return Math.max(1, Math.ceil(nCans / CHIP_COLS));
}

function measureHeight(state) {
  let h = TITLE_BLOCK;
  for (const el of state.elements) {
    h += EL_NAME_H;
    h += (el.cans.length === 0 ? 60 : chipRows(el.cans.length) * CHIP_H);
    h += EL_GAP;
  }
  h += FOOTER_H;
  return Math.max(h, 700);
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

function paintWall(ctx, w, h) {
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, 0, w, h);

  const g1 = ctx.createRadialGradient(w * 0.2, -h * 0.05, 0, w * 0.2, 0, w * 0.9);
  g1.addColorStop(0, 'rgba(48,48,48,0.9)');
  g1.addColorStop(1, 'rgba(48,48,48,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  const g2 = ctx.createRadialGradient(w * 1.05, h * 0.15, 0, w, h * 0.15, w * 0.8);
  g2.addColorStop(0, 'rgba(28,28,28,0.8)');
  g2.addColorStop(1, 'rgba(28,28,28,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  // concrete grain: scattered low-alpha specks
  ctx.save();
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function paintCan(ctx, cx, cy, r, hex) {
  // drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = hex;
  ctx.fill();
  ctx.restore();

  // top highlight to read as a glossy spray dot
  const hg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  hg.addColorStop(0, 'rgba(255,255,255,0.28)');
  hg.addColorStop(0.5, 'rgba(255,255,255,0)');
  hg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();

  // thick dark ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#050505';
  ctx.stroke();
}

export async function renderPaletteCanvas(state, byCode) {
  await ensureFonts();

  const cssH = measureHeight(state);
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  paintWall(ctx, W, cssH);

  // ---- Title on yellow tape ----
  const title = (state.title || '').trim() || 'Untitled mural';
  ctx.save();
  ctx.translate(W / 2, TITLE_TOP + 70);
  ctx.rotate(-0.02);
  ctx.font = `400 68px ${FONT_MARKER}, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = Math.min(CONTENT_W - 20, ctx.measureText(title).width);
  const tapeW = Math.min(CONTENT_W, ctx.measureText(title).width + 80);
  const tapeH = 104;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ffd400';
  roundRect(ctx, -tapeW / 2, -tapeH / 2, tapeW, tapeH, 6);
  ctx.fill();
  ctx.restore();
  // torn tape edges
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(-tapeW / 2, -tapeH / 2, 12, tapeH);
  ctx.fillRect(tapeW / 2 - 12, -tapeH / 2, 12, tapeH);
  ctx.fillStyle = '#171200';
  let fs = 68;
  while (ctx.measureText(title).width > tapeW - 60 && fs > 30) {
    fs -= 2;
    ctx.font = `400 ${fs}px ${FONT_MARKER}, cursive`;
  }
  ctx.fillText(title, 0, 6, tapeW - 50);
  ctx.restore();

  // subtitle
  ctx.font = `500 26px ${FONT_UI}, sans-serif`;
  ctx.fillStyle = '#8f8a80';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('LOOP COLORS 400ml · CAN LIST', W / 2, TITLE_TOP + 168);

  // ---- Elements ----
  let y = TITLE_BLOCK;
  ctx.textAlign = 'left';
  for (const el of state.elements) {
    // element name
    ctx.font = `700 40px ${FONT_UI}, sans-serif`;
    ctx.fillStyle = '#f4f1ea';
    const name = (el.name || 'Element').toUpperCase();
    ctx.fillText(name, MARGIN, y + 46);
    // yellow underline accent
    const nameW = Math.min(CONTENT_W, ctx.measureText(name).width);
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(MARGIN, y + 58, nameW, 4);
    y += EL_NAME_H;

    if (el.cans.length === 0) {
      ctx.font = `500 26px ${FONT_UI}, sans-serif`;
      ctx.fillStyle = '#6b665d';
      ctx.fillText('(no cans yet)', MARGIN + 4, y + 30);
      y += 60;
    } else {
      const colW = CONTENT_W / CHIP_COLS;
      el.cans.forEach((code, i) => {
        const c = byCode.get(code);
        if (!c) return;
        const col = i % CHIP_COLS;
        const row = Math.floor(i / CHIP_COLS);
        const cellX = MARGIN + col * colW;
        const cellY = y + row * CHIP_H;
        const cx = cellX + CIRCLE_R + 12;
        const cy = cellY + CHIP_H / 2 - 6;
        paintCan(ctx, cx, cy, CIRCLE_R, c.hex);

        const tx = cx + CIRCLE_R + 26;
        const maxTextW = colW - (CIRCLE_R * 2 + 12 + 26) - 24;
        ctx.textBaseline = 'alphabetic';
        ctx.font = `700 34px ${FONT_UI}, sans-serif`;
        ctx.fillStyle = '#f4f1ea';
        ctx.fillText(c.code, tx, cy - 4, maxTextW);
        ctx.font = `500 28px ${FONT_UI}, sans-serif`;
        ctx.fillStyle = '#a8a29a';
        ctx.fillText(c.name, tx, cy + 30, maxTextW);
      });
      y += chipRows(el.cans.length) * CHIP_H;
    }
    y += EL_GAP;
  }

  // ---- Footer ----
  ctx.textAlign = 'center';
  ctx.font = `500 24px ${FONT_UI}, sans-serif`;
  ctx.fillStyle = '#6b665d';
  ctx.fillText('Planned with colours.stuc.dev', W / 2, cssH - 40);

  return canvas;
}
