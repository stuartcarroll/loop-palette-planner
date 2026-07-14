// Main app: routing, planner rendering, picker wiring, export view, save/share,
// autosave, Turnstile. Plain ES modules, no framework.
import {
  state, subscribe, notify, replaceState, freshState, hydrate, newId,
  elementCans, totalCans, colourCount, hasAnyColour, flatColours,
  saveDraft, loadDraft, clearDraft, listPieces, rememberPiece, forgetPiece,
  relativeTime, api,
} from '/store.js';
import { initPicker, openPicker } from '/picker.js';
import { renderExportCanvas } from '/canvas.js';
import { TURNSTILE_SITEKEY } from '/config.js';
import qrcode from '/vendor/qrcode.mjs';

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------------------------------------------------------------- autosave
let saveTimer;
function scheduleAutosave() {
  saveDraft();
  if (!state.editToken || state.readOnly) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const r = await api.update(state.editToken);
      state.updatedAt = r.updatedAt || Date.now();
      rememberPiece({ editToken: state.editToken, shareToken: state.shareToken, name: state.pieceName, updatedAt: state.updatedAt });
      updateSubline();
    } catch (e) { /* last-write-wins; surface only hard errors */ console.warn('[autosave]', e.message); }
  }, 800);
}

function mutate(fn) { fn(); notify(); scheduleAutosave(); }
// Text-field edits: update state + autosave WITHOUT re-rendering, so the input
// keeps focus while typing (a full re-render would recreate the field).
function edit(fn) { fn(); scheduleAutosave(); }

// ---------------------------------------------------------------- planner render
function updateSubline() {
  const sub = $('title-sub');
  if (state.editToken) sub.textContent = `Saved · edited ${relativeTime(state.updatedAt) || 'just now'}`;
  else if (state.pieceName || hasAnyColour()) sub.textContent = 'Draft on this device';
  else sub.textContent = 'Name your piece to begin';
}

function renderPlanner() {
  $('title-input').value = state.pieceName;
  updateSubline();
  $('elements-hint').hidden = !hasAnyColour();

  const wrap = $('elements');
  wrap.innerHTML = '';
  for (const el of state.elements) {
    wrap.appendChild(el.colors.length ? renderPopulated(el) : renderEmpty(el));
  }

  const cans = totalCans();
  $('total-cans').textContent = `${cans} ${cans === 1 ? 'can' : 'cans'}`;
  const cols = colourCount();
  $('total-colours').textContent = `${cols} ${cols === 1 ? 'colour' : 'colours'}`;
  $('export-btn').disabled = !hasAnyColour();
}

function roleInput(el, big) {
  const input = document.createElement('input');
  input.className = big ? 'element__role-big' : 'element__role';
  input.type = 'text';
  input.name = `role-${el.id}`;
  input.value = el.role || '';
  input.placeholder = el.isDefault ? el.role : 'Element name';
  input.setAttribute('aria-label', 'Element role');
  input.addEventListener('input', () => edit(() => { el.role = input.value; }));
  input.addEventListener('click', (e) => e.stopPropagation());
  return input;
}

function removeBtn(el) {
  const b = document.createElement('button');
  b.className = 'element__remove';
  b.type = 'button';
  b.textContent = '✕';
  b.setAttribute('aria-label', `Remove ${el.role || 'element'}`);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    mutate(() => { state.elements = state.elements.filter((x) => x.id !== el.id); });
  });
  return b;
}

function renderEmpty(el) {
  const card = document.createElement('div');
  card.className = 'element element--empty';

  const ph = document.createElement('div');
  ph.className = 'element__placeholder';

  const main = document.createElement('div');
  main.className = 'element__empty-main';
  main.appendChild(roleInput(el, true));
  if (el.hint) {
    const hint = document.createElement('div');
    hint.className = 'element__hint';
    hint.textContent = el.hint;
    main.appendChild(hint);
  }

  const add = document.createElement('button');
  add.className = 'element__add-first';
  add.type = 'button';
  add.textContent = '+';
  add.setAttribute('aria-label', `Add a colour to ${el.role || 'element'}`);

  const openAdd = () => openPicker({
    context: `Choose for · ${el.role || 'Element'}`,
    onChoose: (c) => mutate(() => el.colors.push({ ...c, qty: 1 })),
  });
  add.addEventListener('click', (e) => { e.stopPropagation(); openAdd(); });
  ph.addEventListener('click', openAdd);

  card.append(ph, main, removeBtn(el), add);
  return card;
}

function renderPopulated(el) {
  const card = document.createElement('div');
  card.className = 'element';

  // header
  const head = document.createElement('div');
  head.className = 'element__head';
  const left = document.createElement('div');
  left.className = 'element__head-left';
  left.appendChild(roleInput(el, false));
  const cansN = elementCans(el);
  const cans = document.createElement('span');
  cans.className = 'element__cans';
  cans.textContent = `${cansN} ${cansN === 1 ? 'can' : 'cans'}`;
  const right = document.createElement('div');
  right.className = 'element__head-left';
  right.append(cans, removeBtn(el));
  head.append(left, right);

  // colour rows
  const colors = document.createElement('div');
  colors.className = 'colors';
  el.colors.forEach((c, idx) => colors.appendChild(renderColorRow(el, c, idx)));

  // add colour
  const addC = document.createElement('button');
  addC.className = 'add-colour';
  addC.type = 'button';
  addC.innerHTML = '<span class="add-colour__plus">+</span> Add colour';
  addC.addEventListener('click', () => openPicker({
    context: `Choose for · ${el.role || 'Element'}`,
    onChoose: (c) => mutate(() => el.colors.push({ ...c, qty: 1 })),
  }));

  card.append(head, colors, addC);
  return card;
}

function renderColorRow(el, c, idx) {
  const row = document.createElement('div');
  row.className = 'colorrow';

  const sw = document.createElement('button');
  sw.className = 'colorrow__sw';
  sw.type = 'button';
  sw.style.background = c.hex;
  sw.setAttribute('aria-label', `${c.code} ${c.name} — change or remove`);
  sw.addEventListener('click', () => openPicker({
    context: `Choose for · ${el.role || 'Element'}`,
    selectedVendor: c.vendor,
    selectedKey: `${c.vendor}:${c.code}`,
    canRemove: true,
    onChoose: (nc) => mutate(() => { el.colors[idx] = { ...nc, qty: c.qty }; }),
    onRemove: () => mutate(() => { el.colors.splice(idx, 1); }),
  }));

  const meta = document.createElement('div');
  meta.className = 'colorrow__meta';
  const nm = document.createElement('div');
  nm.className = 'colorrow__name';
  nm.textContent = c.name;
  const cd = document.createElement('div');
  cd.className = 'colorrow__code';
  cd.textContent = c.code;
  meta.append(nm, cd);

  const stepper = document.createElement('div');
  stepper.className = 'stepper';
  const minus = document.createElement('button');
  minus.className = 'stepper__btn stepper__btn--minus';
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Decrease quantity');
  minus.addEventListener('click', () => mutate(() => { c.qty = Math.max(1, c.qty - 1); }));
  const val = document.createElement('div');
  val.className = 'stepper__val';
  val.textContent = c.qty;
  const plus = document.createElement('button');
  plus.className = 'stepper__btn stepper__btn--plus';
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Increase quantity');
  plus.addEventListener('click', () => mutate(() => { c.qty = Math.min(99, c.qty + 1); }));
  stepper.append(minus, val, plus);

  const rm = document.createElement('button');
  rm.className = 'colorrow__remove';
  rm.type = 'button';
  rm.textContent = '✕';
  rm.setAttribute('aria-label', `Remove ${c.name}`);
  rm.addEventListener('click', () => mutate(() => { el.colors.splice(idx, 1); }));

  row.append(sw, meta, stepper, rm);
  return row;
}

// ---------------------------------------------------------------- export view
function renderExportView() {
  const s = state;
  const items = flatColours(s);
  $('export-title').textContent = s.readOnly ? 'Shared can list' : 'Your can list';

  const bars = $('preview-bars');
  bars.innerHTML = '';
  (items.length ? items : [{ hex: '#26282B' }]).forEach((c) => {
    const d = document.createElement('div');
    d.style.background = c.hex;
    bars.appendChild(d);
  });

  $('preview-name').textContent = (s.pieceName || '').trim() || 'Untitled piece';
  $('preview-meta').textContent = `${colourCount(s)} colours · ${totalCans(s)} cans`;
  import('/canvas.js').then(({ brandForState }) => { $('preview-brand').textContent = brandForState(s); });

  const list = $('shopping-list');
  list.innerHTML = '';
  for (const c of items) {
    const row = document.createElement('div');
    row.className = 'shopitem';
    const sw = document.createElement('div');
    sw.className = 'shopitem__sw';
    sw.style.background = c.hex;
    const meta = document.createElement('div');
    meta.className = 'shopitem__meta';
    const nm = document.createElement('div');
    nm.className = 'shopitem__name';
    nm.textContent = c.name;
    const sub = document.createElement('div');
    sub.className = 'shopitem__sub';
    sub.textContent = `${c.code} · ${c.role}`;
    meta.append(nm, sub);
    const qty = document.createElement('div');
    qty.className = 'shopitem__qty';
    qty.textContent = `×${c.qty}`;
    row.append(sw, meta, qty);
    list.appendChild(row);
  }

  const cans = totalCans(s);
  $('total-row-value').textContent = `${cans} ${cans === 1 ? 'can' : 'cans'}`;
}

function showExport() { renderExportView(); $('planner').hidden = true; $('export-view').hidden = false; window.scrollTo(0, 0); }
function hideExport() { $('export-view').hidden = true; $('planner').hidden = false; }

// ---------------------------------------------------------------- PNG / share / copy
function canvasToBlob(canvas) {
  return new Promise((res) => {
    if (canvas.toBlob) canvas.toBlob((b) => res(b), 'image/png');
    else res(null);
  });
}
function fileName() {
  const base = (state.pieceName || 'can-list').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'can-list';
  return `${base}.png`;
}

async function downloadPng() {
  const btn = $('download-png');
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
  try {
    const canvas = await renderExportCanvas(state);
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error('render failed');
    const file = makeFile(blob);
    if (canShareFiles(file)) {
      try { await navigator.share({ files: [file], title: state.pieceName || 'Can list' }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) { toast('Export failed'); console.error(e); }
  finally { btn.disabled = false; btn.textContent = label; }
}

function makeFile(blob) {
  try { return new File([blob], fileName(), { type: 'image/png' }); }
  catch { blob.name = fileName(); return blob; }
}
function canShareFiles(file) {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' && file instanceof File && navigator.canShare({ files: [file] });
}

function copyList() {
  const groups = new Map(); // vendorId -> items
  for (const c of flatColours(state)) {
    const key = c.vendor;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  let out = `${state.pieceName || 'Untitled piece'} — ${totalCans(state)} cans\n`;
  import('/data/vendors.js').then(({ VENDORS }) => {
    const brand = (id) => (VENDORS.find((v) => v.id === id) || {}).brand || id;
    let text = out + '\n';
    for (const [vid, items] of groups) {
      const vcans = items.reduce((n, c) => n + c.qty, 0);
      text += `${brand(vid)} — ${vcans} cans\n`;
      for (const c of items) text += `  ${c.qty} × ${c.code} ${c.name} — ${c.role}\n`;
      text += '\n';
    }
    navigator.clipboard.writeText(text.trim())
      .then(() => toast('Can list copied'))
      .catch(() => toast('Copy failed'));
  });
}

// ---------------------------------------------------------------- Turnstile
let turnstileScript;
function loadTurnstile() {
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile load failed'));
    document.head.appendChild(s);
  });
  return turnstileScript;
}
async function getTurnstileToken() {
  try {
    await loadTurnstile();
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(holder);
    return await new Promise((resolve) => {
      let done = false;
      const finish = (tok) => { if (done) return; done = true; try { window.turnstile.remove(id); } catch {} holder.remove(); resolve(tok); };
      const id = window.turnstile.render(holder, {
        sitekey: TURNSTILE_SITEKEY,
        callback: (t) => finish(t),
        'error-callback': () => finish(''),
        'timeout-callback': () => finish(''),
      });
      window.turnstile.execute(id);
      setTimeout(() => finish(''), 8000);
    });
  } catch { return ''; }
}

// ---------------------------------------------------------------- save / share flows
async function ensureSaved() {
  if (state.editToken) return true;
  const token = await getTurnstileToken();
  const r = await api.create(token);
  state.id = r.id; state.editToken = r.editToken; state.shareToken = r.shareToken;
  state.updatedAt = r.updatedAt || Date.now();
  rememberPiece({ editToken: state.editToken, shareToken: state.shareToken, name: state.pieceName, updatedAt: state.updatedAt });
  clearDraft();
  history.replaceState(null, '', `/?p=${state.editToken}`);
  updateSubline();
  return true;
}

async function doSave() {
  if (state.readOnly) return;
  const btn = $('btn-save'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const created = !state.editToken;
    await ensureSaved();
    if (!created) { await api.update(state.editToken); }
    showLinkModal({
      title: 'Your edit link',
      sub: 'Keep this link to edit from any device',
      url: `${location.origin}/?p=${state.editToken}`,
    });
  } catch (e) { toast(saveErr(e)); }
  finally { btn.disabled = false; btn.textContent = label; }
}

async function doShare() {
  if (state.readOnly) { // already viewing a read-only link — just share/copy it
    return shareUrl(location.href);
  }
  const btn = $('btn-share'); const label = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    await ensureSaved();
    showLinkModal({
      title: 'Read-only share link',
      sub: 'Anyone with this link sees the can list (no editing)',
      url: `${location.origin}/?s=${state.shareToken}`,
    });
  } catch (e) { toast(saveErr(e)); }
  finally { btn.disabled = false; btn.textContent = label; }
}

async function shareUrl(url) {
  if (navigator.share) {
    try { await navigator.share({ title: state.pieceName || 'Palette', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Copy failed'); }
}

function saveErr(e) {
  if (e.status === 429) return 'Too many saves — try again later';
  if (e.status === 400) return 'Verification failed — reload and retry';
  return 'Save failed — check connection';
}

// ---------------------------------------------------------------- link modal + QR
function showLinkModal({ title, sub, url }) {
  $('link-modal-title').textContent = title;
  $('link-modal-sub').textContent = sub;
  $('link-input').value = url;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('qr-holder').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  $('link-modal').hidden = false;
  $('link-modal').setAttribute('aria-hidden', 'false');
}
function closeLinkModal() { $('link-modal').hidden = true; }

// ---------------------------------------------------------------- new piece
function newPiece() {
  clearDraft();
  replaceState(freshState());
  history.replaceState(null, '', '/');
  notify();
  toast('New piece');
}

// ---------------------------------------------------------------- boot
function applyReadOnly() {
  document.body.classList.add('read-only');
  $('export-back').addEventListener('click', () => { location.href = '/'; });
}

async function boot() {
  initPicker();
  wireStaticControls();
  subscribe(renderPlanner);

  const params = new URLSearchParams(location.search);
  const editToken = params.get('p');
  const shareToken = params.get('s');

  if (shareToken) {
    try {
      const r = await api.loadShared(shareToken);
      const s = hydrate(r.data);
      s.pieceName = r.name || s.pieceName;
      s.readOnly = true;
      s.updatedAt = r.updatedAt;
      replaceState(s);
      applyReadOnly();
      showExport();
      return;
    } catch (e) { toast('Shared piece not found'); }
  }

  if (editToken) {
    try {
      const r = await api.load(editToken);
      const s = hydrate(r.data);
      s.id = r.id; s.editToken = editToken; s.shareToken = r.shareToken;
      s.pieceName = r.name || s.pieceName; s.updatedAt = r.updatedAt;
      replaceState(s);
      rememberPiece({ editToken, shareToken: r.shareToken, name: s.pieceName, updatedAt: s.updatedAt });
      notify();
      return;
    } catch (e) { toast('Piece not found — starting fresh'); history.replaceState(null, '', '/'); }
  }

  const draft = loadDraft();
  if (draft) replaceState(Object.assign(freshState(), draft));
  notify();
}

function wireStaticControls() {
  $('title-input').addEventListener('input', (e) => { edit(() => { state.pieceName = e.target.value; }); updateSubline(); });
  $('add-element').addEventListener('click', () => {
    mutate(() => state.elements.push({ id: newId(), role: '', colors: [] }));
    const last = $('elements').lastElementChild;
    last?.querySelector('.element__role-big, .element__role')?.focus();
  });
  $('export-btn').addEventListener('click', showExport);
  $('export-back').addEventListener('click', hideExport);
  $('download-png').addEventListener('click', downloadPng);
  $('copy-list').addEventListener('click', copyList);
  $('share-btn').addEventListener('click', doShare); // export-screen Share → read-only link

  $('btn-new').addEventListener('click', newPiece);
  $('btn-save').addEventListener('click', doSave);
  $('btn-share').addEventListener('click', doShare);
  document.querySelectorAll('[data-close-linkmodal]').forEach((n) => n.addEventListener('click', closeLinkModal));
  $('link-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('link-input').value).then(() => toast('Link copied')).catch(() => toast('Copy failed'));
  });
}

boot();
