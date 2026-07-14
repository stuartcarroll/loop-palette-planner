// Colour picker bottom sheet: vendor tabs, search, family chips, grouped grid.
// Vendor datasets are lazy-imported (generated ES modules under /data/).
import { VENDORS, FAMILY_ORDER } from '/data/vendors.js';

const el = (id) => document.getElementById(id);
const overlay = () => el('picker');

const cache = new Map(); // vendorId -> COLORS[]
async function loadVendor(id) {
  if (cache.has(id)) return cache.get(id);
  const mod = await import(`/data/${id}.js`);
  cache.set(id, mod.COLORS);
  return mod.COLORS;
}

let ctx = null; // { onChoose, onRemove, canRemove, selectedKey }
let activeVendor = VENDORS[0].id;
let searchQuery = '';
let activeFamily = 'All';

const codeKey = (code) => String(code).toLowerCase().replace(/[\s-]/g, '');
const keyOf = (vendor, code) => `${vendor}:${code}`;

export function isOpen() { return !overlay().hidden; }

export async function openPicker(options) {
  ctx = options;
  searchQuery = '';
  activeFamily = 'All';
  // If editing an existing colour from a specific vendor, start on that tab.
  if (options.selectedVendor && VENDORS.some((v) => v.id === options.selectedVendor)) {
    activeVendor = options.selectedVendor;
  }
  el('picker-search').value = '';
  el('picker-context').textContent = options.context || 'Choose a colour';
  el('picker-remove-wrap').hidden = !options.canRemove;

  renderTabs();
  overlay().hidden = false;
  overlay().setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  await refreshGrid();
  if (!('ontouchstart' in window)) el('picker-search').focus();
}

export function closePicker() {
  overlay().hidden = true;
  overlay().setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  ctx = null;
}

function renderTabs() {
  const wrap = el('vendor-tabs');
  wrap.innerHTML = '';
  for (const v of VENDORS) {
    const b = document.createElement('button');
    b.className = 'vendor-tab' + (v.id === activeVendor ? ' is-active' : '');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.innerHTML = `<div class="vendor-tab__label"></div><div class="vendor-tab__count"></div>`;
    b.querySelector('.vendor-tab__label').textContent = v.label;
    b.querySelector('.vendor-tab__count').textContent = `${v.count} cans`;
    b.addEventListener('click', async () => {
      if (activeVendor === v.id) return;
      activeVendor = v.id;
      activeFamily = 'All';
      renderTabs();
      await refreshGrid();
      const active = wrap.querySelector('.is-active');
      active?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    wrap.appendChild(b);
  }
}

async function refreshGrid() {
  const colors = await loadVendor(activeVendor);
  renderChips(colors);
  renderGrid(colors);
}

function familiesIn(colors) {
  const present = new Set(colors.map((c) => c.family));
  return FAMILY_ORDER.filter((f) => present.has(f));
}

function renderChips(colors) {
  const wrap = el('family-chips');
  wrap.innerHTML = '';
  const chips = ['All', ...familiesIn(colors)];
  for (const fam of chips) {
    const b = document.createElement('button');
    b.className = 'chip' + (fam === activeFamily ? ' is-active' : '');
    b.type = 'button';
    b.textContent = fam;
    b.addEventListener('click', () => {
      activeFamily = fam;
      renderChips(colors);
      renderGrid(colors);
    });
    wrap.appendChild(b);
  }
}

function filterColours(colors) {
  const q = searchQuery.trim().toLowerCase();
  const qn = q.replace(/[\s-]/g, '');
  return colors.filter((c) => {
    if (activeFamily !== 'All' && c.family !== activeFamily) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || codeKey(c.code).includes(qn);
  });
}

function renderGrid(colors) {
  const grid = el('picker-grid');
  const list = filterColours(colors);
  el('picker-empty').hidden = list.length > 0;
  grid.innerHTML = '';

  // group by family in canonical order
  const byFam = new Map();
  for (const c of list) {
    if (!byFam.has(c.family)) byFam.set(c.family, []);
    byFam.get(c.family).push(c);
  }
  const frag = document.createDocumentFragment();
  for (const fam of FAMILY_ORDER) {
    const group = byFam.get(fam);
    if (!group) continue;
    const wrap = document.createElement('div');
    wrap.className = 'picker-group';
    const head = document.createElement('div');
    head.className = 'picker-group__head';
    head.textContent = fam;
    const g = document.createElement('div');
    g.className = 'picker-group__grid';
    for (const c of group) {
      const selected = ctx?.selectedKey === keyOf(activeVendor, c.code);
      const b = document.createElement('button');
      b.className = 'pick-tile' + (selected ? ' is-selected' : '');
      b.type = 'button';
      b.setAttribute('aria-label', `${c.code} ${c.name}`);
      b.title = `${c.code} · ${c.name}`;

      const sw = document.createElement('span');
      sw.className = 'pick-tile__sw';
      sw.style.background = c.hex;
      if (selected) {
        const chk = document.createElement('span');
        chk.className = 'swatch__check';
        chk.textContent = '✓';
        sw.appendChild(chk);
      }
      const name = document.createElement('span');
      name.className = 'pick-tile__name';
      name.textContent = c.name;
      const code = document.createElement('span');
      code.className = 'pick-tile__code';
      code.textContent = c.code;

      b.append(sw, name, code);
      b.addEventListener('click', () => {
        const chosen = { vendor: activeVendor, code: c.code, name: c.name, hex: c.hex };
        const fn = ctx?.onChoose;
        closePicker();
        fn?.(chosen);
      });
      g.appendChild(b);
    }
    wrap.append(head, g);
    frag.appendChild(wrap);
  }
  grid.innerHTML = '';
  grid.appendChild(frag);
  grid.scrollTop = 0;
}

export function initPicker() {
  el('picker-search').addEventListener('input', async (e) => {
    searchQuery = e.target.value;
    const colors = await loadVendor(activeVendor);
    renderGrid(colors);
  });
  el('picker-remove').addEventListener('click', () => {
    const fn = ctx?.onRemove;
    closePicker();
    fn?.();
  });
  document.querySelectorAll('[data-close-picker]').forEach((n) => n.addEventListener('click', closePicker));
  // Warm the default vendor so the first open is instant.
  loadVendor(activeVendor).catch(() => {});
}
