# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Palette** — a mobile-first, framework-free web app for planning spray-paint
mural palettes across six real manufacturer ranges (Loop, Montana GOLD/BLACK,
MTN 94/Hardcore, Molotow). Users assign one or more cans to each **element**
(Fill, Outline, 3D, Background, Band, + custom), set per-can quantities, and
export a shareable can list. Pieces can be saved (edit link) and shared
(read-only link) with no accounts.

- **Live:** https://colours.stuc.dev
- **Stack:** plain static HTML/CSS/ES-modules + a single Cloudflare Worker
  (serves the static assets AND a JSON API backed by D1). No framework, no bundler.

## Layout

```
public/                 # static site (served by the Worker's ASSETS binding)
  index.html            # shell: planner, picker sheet, export view, link/QR modal
  styles.css            # all styling (dark near-mono theme, lime accent)
  app.js                # entry: routing, planner render, save/share, Turnstile
  store.js              # state, derived totals, localStorage, API client
  picker.js             # colour picker sheet (vendor tabs, search, family groups)
  canvas.js             # 1080px PNG export renderer
  config.js             # TURNSTILE_SITEKEY (public; swap for real key)
  vendor/qrcode.mjs     # vendored QR generator (MIT)
  data/*.js             # GENERATED per-vendor colour modules + vendors.js
  fonts/                # self-hosted woff2 (Space Grotesk/Instrument Sans/Space Mono)
  icons/                # GENERATED PWA icons
worker/index.js         # Cloudflare Worker: /api/* + scheduled() cron
migrations/*.sql        # D1 schema
scripts/
  build-data.mjs        # xlsx -> public/data/*.js (families via HSL, validated)
  make-icons.mjs        # SVG -> public/icons/*.png
  serve.mjs             # static-only local server (prefer `wrangler dev`)
data/*.xlsx             # source colour data (from stuartcarroll/SprayPaintSwatches)
wrangler.jsonc          # Worker + assets + D1 + cron + custom domain
```

## Commands

```bash
npm run build            # build:data + build:icons (regenerates generated files)
npm run db:migrate:local # apply D1 migrations to local dev DB
npx wrangler dev         # Worker + assets + local D1 (use this, not `npm run dev`)
npm run db:migrate       # apply migrations to REMOTE D1
npx wrangler deploy      # deploy Worker (CI also does this on push to main)
```

No test suite/linter. Data correctness is enforced in `build-data.mjs` (exits
non-zero on bad hex, dup code, or wrong vendor count).

## How it works

- **No runtime data fetch.** `public/data/<vendor>.js` are generated at build
  time and dynamically imported by the picker on demand. `vendors.js` is the
  manifest (id, label, brand, count). Never fetch swatch data at runtime.
- **State** (`store.js`): `{ id, editToken, shareToken, pieceName, elements, readOnly }`
  where `elements: [{ id, role, hint?, isDefault?, colors: [{vendor,code,name,hex,qty}] }]`.
  A colour's identity is `vendor + code`; an element with >1 colour is a fade.
- **Two mutation paths in app.js:** `mutate(fn)` = `fn()` + `notify()` (full
  re-render) + autosave — for structural changes (add/remove colour or element,
  quantity steppers). `edit(fn)` = `fn()` + autosave WITHOUT re-render — for the
  role/title text inputs, so the focused field isn't destroyed mid-typing.
- **Persistence:** unsaved work is a localStorage draft. **Save** →
  `POST /api/pieces` (Turnstile token + rate-limited) returns edit + share tokens;
  thereafter edits autosave via debounced `PUT`. There is no "My pieces" list —
  no login, so the edit link/QR is the only way back into a saved piece. Top-bar
  `New` / `Save` / `Share` buttons drive these (no overflow menu).
- **Routing** is query-param based on `/`: `?p=<editToken>` opens the editor,
  `?s=<shareToken>` opens the read-only can list. Keeps all navigation on `/`
  (a static asset) so the Worker only handles `/api/*`.
- **Worker** (`worker/index.js`): static assets are served first by the runtime;
  the Worker runs only for non-asset paths. It routes `/api/*` to D1 and defers
  everything else to `env.ASSETS.fetch`. `scheduled()` is the daily TTL cron.
- **Abuse protection:** Turnstile verify on create (secret = `TURNSTILE_SECRET`),
  D1 `write_log` per-IP rate limit (20/hr), 10 KB cap, 12-month TTL cron.

## Gotchas

- Tokens: `crypto.getRandomValues` only, never `Math.random`.
- Turnstile keys default to Cloudflare test keys (always pass). Real protection
  needs a real site key in `config.js` + `wrangler secret put TURNSTILE_SECRET`.
- D1 binding is `DB`; database is `loop_palette`. Migrations must be applied to
  BOTH local (`--local`) and remote before the API works there.
- The export PNG awaits `document.fonts.load(...)` before painting text.
