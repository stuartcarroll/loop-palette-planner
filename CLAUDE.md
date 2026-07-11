# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Loop Colors Palette Planner** — a mobile-first, framework-free web app for
planning graffiti mural colour palettes with the real **Loop Colors 400ml**
spray range (216 cans). Users name mural elements (fill, outline, 3D,
background…), assign one or more cans to each, then export a shareable PNG
"can list" so the crew knows which cans to buy.

- **Live:** https://colours.stuc.dev
- **Stack:** plain static HTML/CSS/JS (ES modules, no framework, no bundler).
  Deployed as a static-assets-only **Cloudflare Worker**.
- **Build step:** only generates data + icons; the app itself ships as-is.

## Layout

```
public/                 # THE DEPLOYED SITE — this is what Cloudflare serves
  index.html            # single page; all markup lives here
  styles.css            # all styling (dark "concrete wall" theme)
  app.js                # UI, state, localStorage, colour picker, share/export trigger
  export.js             # 1080px <canvas> PNG renderer (imported by app.js)
  colors.js             # GENERATED — do not hand-edit; 216 {code,name,hex}
  fonts/                # self-hosted woff2 (Permanent Marker + Barlow Condensed) + fonts.css
  icons/                # GENERATED PWA icons + icon.svg
  manifest.webmanifest
scripts/
  build-colors.mjs      # data/loop_colors.xlsx -> public/colors.js (with validation)
  make-icons.mjs        # inline SVG -> public/icons/*.png via sharp
  serve.mjs             # minimal local static server (no deps)
data/loop_colors.xlsx   # source colour data (from stuartcarroll/SprayPaintSwatches)
wrangler.jsonc          # Cloudflare Worker config (assets-only, custom domain)
package.json
```

## Commands

```bash
npm install
npm run build          # build:colors + build:icons — regenerates generated files
npm run build:colors   # xlsx -> public/colors.js (validates: 216 cans, hex format, no dupes)
npm run build:icons    # SVG -> public/icons/*.png
npm run dev            # serve public/ at http://localhost:4321 (PORT env overrides)
npm run deploy         # wrangler deploy — publishes ./public to colours.stuc.dev
```

There is **no test suite, linter, or typechecker**. Correctness for the colour
data is enforced by validation inside `build-colors.mjs` (it `process.exit(1)`s
on a bad hex, non-`LP-` code, duplicate code, wrong total, or a missing LP-450).

## How it works (architecture)

- **No runtime data fetch.** `public/colors.js` is generated at build time and
  imported directly as an ES module. Never fetch colour data at runtime.
- **State** lives in `app.js` as a single `state` object
  `{ title, elements: [{ id, name, cans: [code…] }] }`, persisted to
  `localStorage` under key `loop-palette-v1`. `load()` re-keys element ids and
  drops any can code no longer present in the range (forward-compatible).
- **Rendering is manual DOM.** No virtual DOM/framework. `renderElements()`
  rebuilds the list from `state`; call `save()` then `renderElements()` after
  any mutation. There is intentionally no reactive layer.
- **Colour picker** is a full-screen overlay (`#picker`) reused for both
  add-a-can and change-a-can, tracked via `pickerTarget`.
- **Export** (`export.js`) draws the palette onto an off-screen `<canvas>` at
  1080px CSS width (scaled by DPR, capped at 2×): concrete-wall background,
  marker title on yellow tape, then can chips. Fonts are awaited via
  `document.fonts.load` **before** any text is painted. `app.js` then tries the
  Web Share API with the PNG file (drops into WhatsApp etc. on mobile) and falls
  back to a full-screen preview with download/share.

## Conventions

- **British spelling** in user-facing copy and identifiers: "colour", "colours".
- **Vanilla ES modules** only — keep it dependency-free at runtime. `devDependencies`
  (`sharp`, `wrangler`, `xlsx`) are build/deploy-time only and must not leak into
  `public/`.
- **`public/` is the source of truth for the site.** Edit `index.html`,
  `styles.css`, `app.js`, `export.js` directly.
- **Never hand-edit generated files** (`public/colors.js`, `public/icons/*`).
  Change the source (`data/loop_colors.xlsx` or the script) and re-run the build.
- **Colour data quirks:** 5 core black/white cans (LP-100/101/103/104/105) are
  added manually in `build-colors.mjs` because they're absent from the sheet;
  total must stay **216**. LP-450 must not be deduped away. Codes are `LP-xxx`;
  search normalises via `codeKey` (`"LP-413"` → `"lp413"`).
- **Mobile-first + accessible:** safe-area insets, 44px touch targets, `aria-*`
  labels on interactive controls, avoid autofocus on touch (keyboard covers the
  grid). Preserve these when touching markup/CSS.
- **Escape user/data strings** rendered as HTML via the existing `escapeHtml`
  helper (see the picker grid).

## Deployment

Static-assets-only Worker — `wrangler.jsonc` has no `main`, just
`assets.directory: "./public"` and a `custom_domain` route for
`colours.stuc.dev`. `npm run deploy` uploads `public/` as-is; there is no server
code. The `stuc.dev` zone must live in the deploying Cloudflare account.

## Making changes

- **New colours / data change:** edit `data/loop_colors.xlsx` (or the `MANUAL`
  list / parsing in `build-colors.mjs`), run `npm run build:colors`, and commit
  the regenerated `public/colors.js`. Watch the 216 total and validation.
- **UI/behaviour change:** edit files in `public/` and verify with `npm run dev`.
- **Icon/branding change:** edit the SVG in `make-icons.mjs`, run
  `npm run build:icons`, commit the regenerated PNGs.
- **Export image change:** edit `public/export.js`; layout is driven by the
  constants at the top (`W`, `CHIP_H`, `CIRCLE_R`, etc.).

## Git workflow

Commit generated files (`public/colors.js`, `public/icons/*`) alongside their
sources so a plain `wrangler deploy` always works without a build.
`node_modules/` and `.wrangler/` are gitignored.

**CI/CD:** `.github/workflows/deploy.yml` runs `cloudflare/wrangler-action` on
every push to `main` (and on manual dispatch), publishing `public/` to
`colours.stuc.dev`. It needs two repo secrets — `CLOUDFLARE_API_TOKEN` (a token
with *Edit Cloudflare Workers* permission on the account owning the `stuc.dev`
zone) and `CLOUDFLARE_ACCOUNT_ID`. There is no build step in CI because the
generated files are committed; if you change `data/loop_colors.xlsx` or an icon
source, run `npm run build` locally and commit the regenerated output. There is
still no test/lint CI.
