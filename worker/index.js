// Cloudflare Worker: serves the static frontend (via the ASSETS binding) and a
// small JSON API backed by D1. Static assets are served first by the runtime;
// this Worker only runs for paths that don't match a file (i.e. /api/*).

const MAX_JSON_BYTES = 10 * 1024;      // 10 KB cap on piece payloads
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 20;                   // creates per IP per window
const TTL_MS = 365 * 24 * 60 * 60 * 1000; // delete pieces untouched 12 months

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: 'Server error' }, 500);
      }
    }
    // Non-API: defer to static assets.
    return env.ASSETS.fetch(request);
  },

  // Daily cron: purge stale pieces + old rate-limit rows.
  async scheduled(event, env, ctx) {
    const now = Date.now();
    ctx.waitUntil((async () => {
      await env.DB.prepare('DELETE FROM pieces WHERE updated_at < ?').bind(now - TTL_MS).run();
      await env.DB.prepare('DELETE FROM write_log WHERE created_at < ?').bind(now - RATE_WINDOW_MS).run();
    })());
  },
};

async function handleApi(request, env, url) {
  const method = request.method;
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  // POST /api/pieces
  if (parts.length === 2 && parts[1] === 'pieces' && method === 'POST') {
    return createPiece(request, env);
  }
  // /api/pieces/:editToken
  if (parts.length === 3 && parts[1] === 'pieces') {
    const editToken = decodeURIComponent(parts[2]);
    if (method === 'GET') return loadPiece(env, editToken);
    if (method === 'PUT') return updatePiece(request, env, editToken);
    if (method === 'DELETE') return deletePiece(env, editToken);
  }
  // GET /api/shared/:shareToken
  if (parts.length === 3 && parts[1] === 'shared' && method === 'GET') {
    return loadShared(env, decodeURIComponent(parts[2]));
  }
  return json({ error: 'Not found' }, 404);
}

// ---------------------------------------------------------------- handlers
async function createPiece(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Bad request' }, 400);

  // Turnstile (abuse protection replacing email verification).
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ok = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!ok) return json({ error: 'Verification failed' }, 400);

  // Per-IP rate limit.
  const now = Date.now();
  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM write_log WHERE ip = ? AND created_at > ?'
  ).bind(ip, now - RATE_WINDOW_MS).all();
  if ((results?.[0]?.n || 0) >= RATE_MAX) return json({ error: 'Rate limit exceeded' }, 429);

  const data = sanitisePiece(body);
  const dataStr = JSON.stringify(data);
  if (dataStr.length > MAX_JSON_BYTES) return json({ error: 'Piece too large' }, 413);

  const editToken = randomToken();
  const shareToken = randomToken();
  await env.DB.prepare(
    'INSERT INTO pieces (edit_token, share_token, name, data_json, created_at, updated_at) VALUES (?,?,?,?,?,?)'
  ).bind(editToken, shareToken, data.pieceName.slice(0, 200), dataStr, now, now).run();
  await env.DB.prepare('INSERT INTO write_log (ip, created_at) VALUES (?,?)').bind(ip, now).run();

  return json({ editToken, shareToken, updatedAt: now });
}

async function loadPiece(env, editToken) {
  const row = await env.DB.prepare(
    'SELECT id, name, data_json, share_token, updated_at FROM pieces WHERE edit_token = ?'
  ).bind(editToken).first();
  if (!row) return json({ error: 'Not found' }, 404);
  return json({ id: row.id, name: row.name, data: JSON.parse(row.data_json), shareToken: row.share_token, updatedAt: row.updated_at });
}

async function updatePiece(request, env, editToken) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Bad request' }, 400);
  const data = sanitisePiece(body);
  const dataStr = JSON.stringify(data);
  if (dataStr.length > MAX_JSON_BYTES) return json({ error: 'Piece too large' }, 413);

  const now = Date.now();
  const res = await env.DB.prepare(
    'UPDATE pieces SET name = ?, data_json = ?, updated_at = ? WHERE edit_token = ?'
  ).bind(data.pieceName.slice(0, 200), dataStr, now, editToken).run();
  if (!res.meta.changes) return json({ error: 'Not found' }, 404);
  return json({ updatedAt: now });
}

async function deletePiece(env, editToken) {
  const res = await env.DB.prepare('DELETE FROM pieces WHERE edit_token = ?').bind(editToken).run();
  if (!res.meta.changes) return json({ error: 'Not found' }, 404);
  return json({ ok: true });
}

async function loadShared(env, shareToken) {
  const row = await env.DB.prepare(
    'SELECT name, data_json, updated_at FROM pieces WHERE share_token = ?'
  ).bind(shareToken).first();
  if (!row) return json({ error: 'Not found' }, 404);
  return json({ name: row.name, data: JSON.parse(row.data_json), updatedAt: row.updated_at });
}

// ---------------------------------------------------------------- helpers
function randomToken() {
  const bytes = new Uint8Array(16); // 128-bit
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return true; // dev fallback if unset (deploy always sets it)
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token || '');
    form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await r.json();
    return !!data.success;
  } catch {
    return false;
  }
}

// Validate + normalise the piece so we never store arbitrary bloat.
function sanitisePiece(body) {
  const pieceName = typeof body.pieceName === 'string' ? body.pieceName.slice(0, 200) : '';
  const elements = Array.isArray(body.elements) ? body.elements.slice(0, 40).map((el) => ({
    id: String(el.id || '').slice(0, 40),
    role: typeof el.role === 'string' ? el.role.slice(0, 60) : '',
    hint: typeof el.hint === 'string' ? el.hint.slice(0, 80) : undefined,
    colors: (Array.isArray(el.colors) ? el.colors.slice(0, 40) : []).map((c) => ({
      vendor: String(c.vendor || '').slice(0, 30),
      code: String(c.code || '').slice(0, 30),
      name: String(c.name || '').slice(0, 60),
      hex: /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex.toLowerCase() : '#000000',
      qty: Math.max(1, Math.min(99, parseInt(c.qty, 10) || 1)),
    })),
  })) : [];
  return { pieceName, elements };
}

async function readJson(request) {
  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES * 2) return null; // guard oversize bodies
    return JSON.parse(text);
  } catch { return null; }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
