import { COLORS } from './colors.js';

// ---------- Data ----------
const BY_CODE = new Map(COLORS.map((c) => [c.code, c]));
// normalized key for fast code search: "LP-413" -> "lp413"
const codeKey = (code) => code.toLowerCase().replace(/[\s-]/g, '');

const DEFAULT_ELEMENTS = [
  { name: 'Fill', cans: ['LP-413', 'LP-411'] },
  { name: 'Outline', cans: ['LP-104'] },
  { name: '3D / Block', cans: ['LP-184'] },
  { name: 'Background', cans: ['LP-251'] },
  { name: 'Highlights', cans: ['LP-100'] },
  { name: 'Character', cans: ['LP-108', 'LP-266'] },
];

const STORAGE_KEY = 'loop-palette-v1';
let uid = 0;
const nextId = () => `el-${++uid}`;

// ---------- State ----------
let state = load() || {
  title: '',
  elements: DEFAULT_ELEMENTS.map((e) => ({ id: nextId(), name: e.name, cans: [...e.cans] })),
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.elements)) return null;
    // re-key ids and drop unknown codes
    data.elements = data.elements.map((e) => ({
      id: nextId(),
      name: String(e.name || ''),
      cans: (Array.isArray(e.cans) ? e.cans : []).filter((c) => BY_CODE.has(c)),
    }));
    data.title = String(data.title || '');
    return data;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

// ---------- Elements ----------
const $ = (sel, root = document) => root.querySelector(sel);
const elementsEl = $('#elements');
const titleInput = $('#title-input');

titleInput.value = state.title;
titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  save();
});

function renderElements() {
  elementsEl.innerHTML = '';
  for (const el of state.elements) {
    elementsEl.appendChild(renderElement(el));
  }
}

function renderElement(el) {
  const wrap = document.createElement('div');
  wrap.className = 'element';
  wrap.dataset.id = el.id;

  const head = document.createElement('div');
  head.className = 'element__head';

  const nameInput = document.createElement('input');
  nameInput.className = 'element__name';
  nameInput.type = 'text';
  nameInput.name = `element-name-${el.id}`;
  nameInput.value = el.name;
  nameInput.placeholder = 'Element';
  nameInput.setAttribute('aria-label', 'Element name');
  nameInput.autocomplete = 'off';
  nameInput.addEventListener('input', () => {
    el.name = nameInput.value;
    save();
  });

  const remove = document.createElement('button');
  remove.className = 'element__remove';
  remove.type = 'button';
  remove.textContent = '🗑';
  remove.setAttribute('aria-label', `Remove ${el.name || 'element'}`);
  remove.addEventListener('click', () => {
    state.elements = state.elements.filter((e) => e.id !== el.id);
    save();
    renderElements();
  });

  head.append(nameInput, remove);

  const swatches = document.createElement('div');
  swatches.className = 'swatches';

  el.cans.forEach((code, idx) => {
    swatches.appendChild(renderSwatch(el, code, idx));
  });

  // add-can tile
  const add = document.createElement('button');
  add.className = 'swatch swatch--add';
  add.type = 'button';
  add.setAttribute('aria-label', 'Add a can');
  add.innerHTML = '<span class="swatch__dot">+</span><span class="swatch__code">ADD</span><span class="swatch__name">can</span>';
  add.addEventListener('click', () => openPicker(el.id, null));
  swatches.appendChild(add);

  wrap.append(head, swatches);
  return wrap;
}

function renderSwatch(el, code, idx) {
  const c = BY_CODE.get(code);
  const btn = document.createElement('button');
  btn.className = 'swatch';
  btn.type = 'button';
  btn.setAttribute('aria-label', `${c.code} ${c.name} — tap to change`);

  const dot = document.createElement('span');
  dot.className = 'swatch__dot';
  dot.style.background = c.hex;

  const codeEl = document.createElement('span');
  codeEl.className = 'swatch__code';
  codeEl.textContent = c.code;

  const nameEl = document.createElement('span');
  nameEl.className = 'swatch__name';
  nameEl.textContent = c.name;

  btn.append(dot, codeEl, nameEl);
  btn.addEventListener('click', () => openPicker(el.id, idx));
  return btn;
}

$('#add-element').addEventListener('click', () => {
  state.elements.push({ id: nextId(), name: '', cans: [] });
  save();
  renderElements();
  // focus the new element's name input
  const last = elementsEl.lastElementChild;
  last?.querySelector('.element__name')?.focus();
});

// ---------- Colour picker ----------
const picker = $('#picker');
const pickerGrid = $('#picker-grid');
const pickerSearch = $('#picker-search');
const pickerEmpty = $('#picker-empty');
let pickerTarget = null; // { elementId, canIndex|null }
let removeBtn = null;

function buildRemoveBtn() {
  const b = document.createElement('button');
  b.className = 'picker__close';
  b.type = 'button';
  b.textContent = 'Remove';
  b.style.width = 'auto';
  b.style.padding = '0 14px';
  b.setAttribute('aria-label', 'Remove this can');
  b.addEventListener('click', () => {
    if (pickerTarget && pickerTarget.canIndex != null) {
      const el = state.elements.find((e) => e.id === pickerTarget.elementId);
      if (el) {
        el.cans.splice(pickerTarget.canIndex, 1);
        save();
        renderElements();
      }
    }
    closePicker();
  });
  return b;
}

function openPicker(elementId, canIndex) {
  pickerTarget = { elementId, canIndex };
  pickerSearch.value = '';
  renderPickerGrid('');
  if (!removeBtn) {
    removeBtn = buildRemoveBtn();
    $('.picker__bar').insertBefore(removeBtn, $('#picker-close'));
  }
  removeBtn.hidden = canIndex == null;
  picker.hidden = false;
  picker.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // Don't autofocus on touch (avoids keyboard covering the grid); user taps search.
  if (!('ontouchstart' in window)) pickerSearch.focus();
}

function closePicker() {
  picker.hidden = true;
  picker.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  pickerTarget = null;
}

$('#picker-close').addEventListener('click', closePicker);
picker.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePicker();
});

pickerSearch.addEventListener('input', () => renderPickerGrid(pickerSearch.value));

function filterColors(query) {
  const q = query.trim().toLowerCase();
  if (!q) return COLORS;
  const qn = q.replace(/[\s-]/g, '');
  return COLORS.filter(
    (c) => c.name.toLowerCase().includes(q) || codeKey(c.code).includes(qn)
  );
}

function renderPickerGrid(query) {
  const list = filterColors(query);
  pickerEmpty.hidden = list.length > 0;
  const frag = document.createDocumentFragment();
  for (const c of list) {
    const b = document.createElement('button');
    b.className = 'pick';
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.setAttribute('aria-label', `${c.code} ${c.name}`);
    b.innerHTML =
      `<span class="pick__dot" style="background:${c.hex}"></span>` +
      `<span class="pick__code">${c.code}</span>` +
      `<span class="pick__name">${escapeHtml(c.name)}</span>`;
    b.addEventListener('click', () => choose(c.code));
    frag.appendChild(b);
  }
  pickerGrid.innerHTML = '';
  pickerGrid.appendChild(frag);
  pickerGrid.scrollTop = 0;
}

function choose(code) {
  if (!pickerTarget) return;
  const el = state.elements.find((e) => e.id === pickerTarget.elementId);
  if (el) {
    if (pickerTarget.canIndex == null) el.cans.push(code);
    else el.cans[pickerTarget.canIndex] = code;
    save();
    renderElements();
  }
  closePicker();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- Export ----------
import { renderPaletteCanvas } from './export.js';

const exportBtn = $('#export-btn');
const exportView = $('#export-view');
const exportImg = $('#export-img');
const exportDownload = $('#export-download');
const exportShareBtn = $('#export-share');
const exportHint = $('#export-hint');
let lastObjectUrl = null;

exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  const original = exportBtn.textContent;
  exportBtn.textContent = 'Rendering…';
  try {
    const canvas = await renderPaletteCanvas(state, BY_CODE);
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error('toBlob returned null');

    const file = makeFile(blob);
    const shareData = {
      title: state.title || 'Loop Colors palette',
      text: `${state.title || 'Mural'} — Loop Colors can list`,
      files: [file],
    };

    // 1) Try native share sheet with the PNG file (best on mobile → WhatsApp etc.)
    if (canShareFiles(file)) {
      try {
        await navigator.share(shareData);
        return; // shared successfully
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user cancelled
        // otherwise fall through to the visual fallback
      }
    }

    // 2) Fallback: show the PNG full-screen with download + optional share.
    showExportView(blob, file);
  } catch (err) {
    console.error('[export] failed', err);
    alertSafe('Sorry — export failed. ' + (err?.message || ''));
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = original;
  }
});

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } else {
      // very old fallback via data URL
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataURLtoBlob(dataUrl));
      } catch {
        resolve(null);
      }
    }
  });
}

function makeFile(blob) {
  const name = fileName();
  try {
    return new File([blob], name, { type: 'image/png' });
  } catch {
    // Some old iOS lack the File constructor; wrap the blob so callers still work.
    blob.name = name;
    return blob;
  }
}

function canShareFiles(file) {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    file instanceof File &&
    navigator.canShare({ files: [file] })
  );
}

function showExportView(blob, file) {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(blob);
  exportImg.src = lastObjectUrl;
  exportDownload.href = lastObjectUrl;
  exportDownload.download = fileName();

  // On touch devices, long-press to save/share is the primary path.
  exportHint.textContent = ('ontouchstart' in window)
    ? 'Long-press the image to share or save'
    : 'Download the PNG, or right-click to save';

  if (canShareFiles(file)) {
    exportShareBtn.hidden = false;
    exportShareBtn.onclick = async () => {
      try {
        await navigator.share({
          title: state.title || 'Loop Colors palette',
          text: `${state.title || 'Mural'} — Loop Colors can list`,
          files: [file],
        });
      } catch (err) {
        if (!(err && err.name === 'AbortError')) console.warn('[share] retry failed', err);
      }
    };
  } else {
    exportShareBtn.hidden = true;
  }

  exportView.hidden = false;
  exportView.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

$('#export-close').addEventListener('click', () => {
  exportView.hidden = true;
  exportView.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
});

function fileName() {
  const base = (state.title || 'loop-palette')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'loop-palette';
  return `${base}.png`;
}

function dataURLtoBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function alertSafe(msg) {
  // Avoid blocking modal dialogs where possible; console + inline hint.
  console.warn(msg);
  exportHint && (exportHint.textContent = msg);
}

// ---------- Boot ----------
renderElements();
