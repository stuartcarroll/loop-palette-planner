# Palette — spray-paint planner

A mobile-first web app for planning graffiti / mural colour palettes using real
manufacturer spray ranges. Name a piece, assign one or more cans to each
**element** (Fill, Outline, 3D, Background, + custom), set a quantity per can,
then export a shareable palette image and shopping / can list.

**Live:** https://colours.stuc.dev

![Palette](public/icons/icon-512.png)

## Features

- **1044 real cans across 6 ranges** — Loop Colors (216), Montana GOLD (193),
  Montana BLACK (164), MTN 94 (169), MTN Hardcore (139), Molotow PREMIUM (163).
  Switch vendor with a tab; a piece (and even a single fade) can mix brands.
- **Fades** — an element holds an *ordered list* of colours; more than one makes
  a fade, and every colour carries its own quantity.
- **Colour picker** — search by name or code, filter/group by colour **family**
  (derived at build time from HSL — the datasets have no family column).
- **Export** — a 1080px PNG can-list card (Web Share on mobile, download
  fallback), plus **Copy list** (plain-text, grouped by vendor).
- **Save & Share, no accounts** — Save stores the piece server-side and returns
  an unguessable **edit link** + QR (a capability URL). Share returns a separate
  read-only link + QR. "My pieces" remembers saves on the device.
- Installable **PWA**; self-hosted fonts (Space Grotesk / Instrument Sans /
  Space Mono); safe-area insets; 44px touch targets. No framework.

## Data

Colours are parsed **at build time** from the xlsx files in
[stuartcarroll/SprayPaintSwatches](https://github.com/stuartcarroll/SprayPaintSwatches)
into static per-vendor ES modules (`public/data/*.js`) — no runtime fetch, no
runtime xlsx parsing. Five core Loop black/white cans absent from the sheet are
added manually (216 total). Thanks to **SprayPaintSwatches** for the swatch data.

## Architecture

- **Frontend:** plain static HTML/CSS/ES-modules in `public/`.
- **Backend:** a single **Cloudflare Worker** (`worker/index.js`) that serves the
  static assets *and* a small JSON API backed by **D1**:
  - `POST /api/pieces` — create (Turnstile-gated, rate-limited) → `{editToken, shareToken}`
  - `GET|PUT|DELETE /api/pieces/:editToken` — load / autosave / delete
  - `GET /api/shared/:shareToken` — read-only load
- **Abuse protection:** Cloudflare **Turnstile** (invisible) on create, D1-backed
  per-IP rate limit (20/hr), 10 KB payload cap, and a daily cron that deletes
  pieces untouched for 12 months.
- Tokens are 128-bit, `crypto.getRandomValues`, base64url.

## Development

```bash
npm install
npm run build                 # generate data modules + PWA icons
npm run db:migrate:local      # apply D1 migrations locally
npx wrangler dev              # run Worker + assets + local D1
```

`.dev.vars` holds `TURNSTILE_SECRET` for local dev (Cloudflare test key).

## Deployment

Cloudflare Worker (static assets + D1), custom domain `colours.stuc.dev`.
Push to `main` auto-deploys via GitHub Actions.

```bash
npm run db:migrate            # apply migrations to remote D1
npx wrangler deploy
npx wrangler secret put TURNSTILE_SECRET
```

### Turnstile

`public/config.js` holds the public Turnstile **site** key; the **secret** is the
Worker secret `TURNSTILE_SECRET`. Both default to Cloudflare's always-pass test
keys — swap in a real widget's keys to activate protection.

## License

MIT
