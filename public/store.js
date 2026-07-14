// Central state, derived totals, local persistence ("My pieces" + draft), and
// the JSON API client. Mutations notify subscribers; app.js re-renders.

const DRAFT_KEY = 'loop-palette-draft-v1';
const PIECES_KEY = 'loop-palette-mypieces-v1';

let _uid = 0;
export const newId = () => `e${Date.now().toString(36)}${(_uid++).toString(36)}`;

export const DEFAULT_ELEMENTS = [
  { role: 'Fill', hint: 'The main body colour' },
  { role: 'Outline', hint: 'Usually black or a dark tone' },
  { role: '3D', hint: 'Shadow / depth colour' },
  { role: 'Background', hint: 'Behind the piece' },
  { role: 'Band', hint: 'Accent band or stripe' },
];

export function freshState() {
  return {
    id: null,
    editToken: null,
    shareToken: null,
    pieceName: '',
    elements: DEFAULT_ELEMENTS.map((d) => ({
      id: newId(), role: d.role, hint: d.hint, isDefault: true, colors: [],
    })),
    updatedAt: null,
    readOnly: false,
  };
}

export const state = freshState();

// ---- pub/sub ----
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function notify() { for (const fn of subs) fn(); }

export function replaceState(next) {
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
}

// ---- derived ----
export const elementCans = (el) => el.colors.reduce((n, c) => n + (c.qty || 0), 0);
export const totalCans = (s = state) => s.elements.reduce((n, el) => n + elementCans(el), 0);
export const colourCount = (s = state) => s.elements.reduce((n, el) => n + el.colors.length, 0);
export const hasAnyColour = (s = state) => s.elements.some((el) => el.colors.length > 0);

// Flattened colour list (element order, then colour order) for export/can list.
export function flatColours(s = state) {
  const out = [];
  for (const el of s.elements) for (const c of el.colors) out.push({ ...c, role: el.role || 'Element' });
  return out;
}

// ---- serialise for server (data_json) ----
export function serialise(s = state) {
  return {
    pieceName: s.pieceName || '',
    elements: s.elements.map((el) => ({
      id: el.id, role: el.role || '', hint: el.hint || undefined,
      colors: el.colors.map((c) => ({ vendor: c.vendor, code: c.code, name: c.name, hex: c.hex, qty: c.qty })),
    })),
  };
}

export function hydrate(data) {
  const s = freshState();
  s.pieceName = String(data?.pieceName || '');
  if (Array.isArray(data?.elements)) {
    s.elements = data.elements.map((el) => ({
      id: el.id || newId(),
      role: String(el.role || ''),
      hint: el.hint,
      colors: (Array.isArray(el.colors) ? el.colors : []).map((c) => ({
        vendor: String(c.vendor || 'loop'), code: String(c.code || ''),
        name: String(c.name || ''), hex: String(c.hex || '#000000'),
        qty: Math.max(1, Math.min(99, parseInt(c.qty, 10) || 1)),
      })),
    }));
  }
  return s;
}

// ---- local draft (unsaved work survives refresh) ----
export function saveDraft() {
  if (state.editToken) return; // saved pieces live server-side
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ pieceName: state.pieceName, elements: serialise().elements })); } catch {}
}
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return hydrate(JSON.parse(raw));
  } catch { return null; }
}
export function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }

// ---- "My pieces" registry ----
export function listPieces() {
  try { return JSON.parse(localStorage.getItem(PIECES_KEY) || '[]'); } catch { return []; }
}
export function rememberPiece({ editToken, shareToken, name, updatedAt }) {
  if (!editToken) return;
  const list = listPieces().filter((p) => p.editToken !== editToken);
  list.unshift({ editToken, shareToken: shareToken || null, name: name || 'Untitled piece', updatedAt: updatedAt || Date.now() });
  try { localStorage.setItem(PIECES_KEY, JSON.stringify(list.slice(0, 50))); } catch {}
}
export function forgetPiece(editToken) {
  try { localStorage.setItem(PIECES_KEY, JSON.stringify(listPieces().filter((p) => p.editToken !== editToken))); } catch {}
}

// ---- relative time ----
export function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

// ---- API client ----
export const api = {
  async create(turnstileToken) {
    const r = await fetch('/api/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...serialise(), turnstileToken }),
    });
    if (!r.ok) throw await apiError(r);
    return r.json(); // { id, editToken, shareToken }
  },
  async update(editToken) {
    const r = await fetch(`/api/pieces/${encodeURIComponent(editToken)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(serialise()),
    });
    if (!r.ok) throw await apiError(r);
    return r.json();
  },
  async load(editToken) {
    const r = await fetch(`/api/pieces/${encodeURIComponent(editToken)}`);
    if (!r.ok) throw await apiError(r);
    return r.json(); // { id, name, data, shareToken, updatedAt }
  },
  async loadShared(shareToken) {
    const r = await fetch(`/api/shared/${encodeURIComponent(shareToken)}`);
    if (!r.ok) throw await apiError(r);
    return r.json(); // { name, data, updatedAt }
  },
};

async function apiError(r) {
  let msg = `HTTP ${r.status}`;
  try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
  const e = new Error(msg); e.status = r.status; return e;
}
