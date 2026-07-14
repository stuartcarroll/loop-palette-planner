# Handoff: Palette Planner redesign (colours.stuc.dev)

## Overview
A spray-paint colour-scheme planner for graffiti / mural artists. The user names a piece, assigns spray-can colours to each **element** (Fill, Outline, 3D, Background, + custom), sets a quantity per can, then exports a shareable palette image and a shopping / can list. Colours come from real manufacturer ranges (Loop Colors, Montana, MTN, Molotow) — selectable via a vendor tab. Mobile-first (used at the wall on a phone).

**Key model:** an element is not limited to one colour — it holds an **ordered list of colours** (a fade / blend when it has more than one), and every colour has its own quantity. A multi-colour element is marked with a small "Fade" badge.

This is a **redesign** of the existing app. The previous version leaned on a title image and high-contrast black/yellow chrome; this design replaces that with quiet, near-monochrome chrome so the actual paint colours are the only saturated thing on screen.

## About the Design Files
The file in this bundle (`Loop Palette Redesign.dc.html`) is a **design reference created in HTML** — a prototype showing the intended look, layout, and behaviour. It is **not production code to copy directly**. The task is to **recreate these designs in the existing colours.stuc.dev codebase** using its established framework, patterns, and libraries. Where the existing app already has data plumbing (the `SprayPaintSwatches` datasets, export-to-PNG, etc.), reuse it — only the UI/visual layer is being replaced.

The prototype is authored as a "Design Component" (custom `<x-dc>` / `<sc-for>` runtime) purely so it renders in the design tool. **Ignore that runtime** — read it for layout, colours, type, spacing, and copy only. The four phone frames are laid out side-by-side on a canvas; each frame is one screen/state.

## Fidelity
**High-fidelity.** Colours, typography, spacing, radii, and copy are final. Recreate the UI to match, using the codebase's existing component patterns. Exact tokens are listed below.

## Design Tokens

### Colour — chrome (neutral)
- App background (bezel/canvas): `#0E0F10`
- Screen background: `#17181A`
- Surface / card: `#1D1E20`
- Surface raised (icon buttons, chips-off, secondary buttons): `#202124` / `#26282B`
- Inset (search field, qty stepper track): `#101112`
- Hairline / border: `rgba(255,255,255,0.06)` – `rgba(255,255,255,0.09)`; dashed placeholders `rgba(255,255,255,0.13–0.18)`
- Text primary: `#EDEDEC`
- Text muted: `#9A9C9F`
- Text faint / meta: `#6C6E71` / `#7C7E81` / `#8A8C8F`
- Primary action fill: `#F2F1ED`, text on it `#0E0F10`
- **Accent (lime), used sparingly only:** `#C7F464` — active can count, selected swatch ring + check, "+" in quantity stepper, active vendor-tab underline, "Fade" badge, brand tag on export card.

### Colour — sample Loop swatches used in the mock (illustrative; real values come from the vendor datasets)
- Cobalt `LP-235` `#2B54C6`, Sky `LP-230` `#6FB7E8`, Black `LP-100` `#15140F`, Ultramarine `LP-238` `#1B2E7A`, Cream `LP-014` `#F4E9C6`.

### Typography
- Display / headings / numbers: **Space Grotesk** (600–700), letter-spacing `-0.02em` on large titles.
- Body / UI / button labels: **Instrument Sans** (400–600).
- Codes, meta, counts, status bar: **Space Mono** (400–700), often `text-transform:uppercase` + `letter-spacing:0.06–0.08em` for labels.
- Sizes: page title 26px; section/heading 20px; colour name 14–15px; body 14–15px; meta/mono labels 9–12px.

### Radius
- Phone bezel 46px, screen 36px; cards 18px; colour swatch (in element) 11px; empty placeholder 13px; picker swatch 12px; icon buttons 11px; pills/inputs 12–14px; qty stepper 11px; small tags/badges 5–9px.

### Spacing
- Screen horizontal padding 22px. Card padding ~12–14px. Gaps between element cards 11px; between colour rows inside an element 8px. Picker grid gap 9px. Touch targets ≥44px on primary controls; qty stepper buttons 30–32px within a 42px+ row.

### Shadow
- Phone frame only (presentation): `0 40px 80px -30px rgba(0,0,0,0.8)`. In-app, picker sheet: `0 -30px 60px -20px rgba(0,0,0,0.6)`. UI is otherwise flat — depth comes from surface colour steps, not shadows.

## Screens / Views

### 1. Start / empty state (`data-screen-label="Empty state"`)
- **Purpose:** name the piece and see the empty element slots.
- **App bar:** left = 26px lime ring mark (`2.5px solid #C7F464` circle) + wordmark **"Palette"** (Space Grotesk 700, 18px). Right = 38px `#202124` rounded-square overflow button (`⋯`).
- **Title input:** placeholder **"Untitled piece"** (Space Grotesk 600, 26px, transparent). Sub-line **"Name your piece to begin"** (Space Mono 12px).
- **"Elements" label** (mono uppercase 11px faint).
- **4 empty element cards** (`#1D1E20`, 1px **dashed** border, radius 18): dashed 50px swatch placeholder (45° hatch), role name + hint, trailing 34px `+`. Roles & hints: **Fill** — "The main body colour"; **Outline** — "Usually black or a dark tone"; **3D** — "Shadow / depth colour"; **Background** — "Behind the piece".
- **"+ Add custom element"** ghost button.
- **Bottom bar:** left "0 cans"; right disabled **Export** (`#26282B` fill, `#6C6E71` text).

### 2. Populated planner (`data-screen-label="Populated planner"`)
- **Purpose:** the working state — elements with one or more colours + per-can quantities.
- App bar as above. Title **"Southbank Piece"** + "Edited just now". Row above list: "Elements" label + "Tap swatch to change" hint.
- **Element card** (`#1D1E20`, 1px solid subtle border, radius 18, padding 12×14):
  - **Header row:** role (mono uppercase 10px faint) + optional **"Fade" badge** (only when >1 colour: lime `#C7F464` fill, dark text, mono 9px uppercase, radius 5). Right: element can total, e.g. "2 cans" (mono 11px).
  - **Colour rows (1..n):** each = 40px colour swatch (`inset 0 0 0 1px rgba(255,255,255,0.14)`) / name (600, 14px) + code (mono 11px) / **quantity stepper** (track `#101112`, radius 11: `−` muted, value mono 700, `+` lime).
  - **"+ Add colour"** row at the card foot (20px `#26282B` chip + muted label) — appends another colour to this element (creating/extending a fade).
  - Sample data: **Fill = Cobalt LP-235 ×1 + Sky LP-230 ×1 (Fade)**, Outline = Black LP-100 ×2, 3D = Ultramarine LP-238 ×1, Background = Cream LP-014 ×2.
- **"+ Add element"** ghost button.
- **Bottom bar:** left **"7 cans"** (Space Grotesk 700, 17px) / **"5 colours"** (mono 11px); right **Export** = primary pill (`#F2F1ED`, dark text). Counts are the totals across all colours of all elements.

### 3. Colour picker (`data-screen-label="Colour picker"`)
- **Purpose:** pick a colour for the active element (adds to its colour list); choose vendor; search; browse by family.
- Presented as a **bottom sheet** over the dimmed planner. Sheet `#1B1C1E`, top corners radius 28, top hairline, drag handle (40×4 pill).
- **Header row:** context label "Choose for · Fill" (mono uppercase 10px) + title **"Choose a colour"** (Space Grotesk 600, 20px); right = 34px round close (`✕`).
- **Vendor tabs** (multi-brand feature): horizontal, scrollable, bottom hairline. Each tab = brand name (Space Grotesk 600, 15px) over can count (mono 10px). **Active:** text `#EDEDEC`, count `#8A8C8F`, **2px `#C7F464` bottom border**. Inactive: text `#7C7E81`, count `#5A5C5F`. Vendors + counts: Loop 211, Montana GOLD 193, Montana BLACK 164, MTN 94 169, MTN Hardcore 139, Molotow 163. Selecting a tab reloads the swatch grid from that vendor's dataset (search + family filters persist).
- **Search field:** inset `#101112`, radius 13, `⌕` + placeholder "Search name or code…". Filters by name and product code.
- **Filter chips:** family filters (All, Yellow, Orange, Red, Pink, Blue, Green…). Active = `#EDEDEC` fill / dark text; inactive = transparent + muted + 1px border; radius 20.
- **Swatch grid grouped by family:** mono-uppercase family header, then a **6-column grid** (gap 9) of squares (radius 12, `inset 0 0 0 1px rgba(255,255,255,0.13)`). **Selected** swatch: `-3px` lime ring (`2.5px solid #C7F464`, radius 14) + 16px lime check badge.

### 4. Export / can list (`data-screen-label="Export / can list"`)
- **Purpose:** review and export the palette.
- App bar: back chevron (`‹`, 36px `#202124`) + title "Your can list".
- **Share-preview card** (radius 20, 1px border): top = 112px-tall row of **every colour** (all elements flattened) as equal-width vertical bars — so a fade shows all its colours; bottom = `#1D1E20` strip with piece name + **"5 colours · 7 cans"** + lime "Loop" brand tag (reflects active vendor).
- **"Shopping list":** one row per can-colour: 34px swatch / name (600, 14px) / "code · role" (mono 11px) / **×qty** (mono 700). An element with a fade contributes multiple rows sharing the same role (e.g. two "Fill" rows).
- **Total** row (top hairline): "Total" / **"7 cans"**.
- **Actions:** primary full-width **Download PNG** pill (`#F2F1ED`, dark text); below, two equal secondary buttons **Copy list** and **Share** (`#202124`).

## Interactions & Behavior
- **Assign / add colour:** tap an element's swatch or its "+ Add colour" → open picker sheet (slides up). Selecting a swatch appends that colour to the element's ordered colour list (first colour = base; further colours build a fade) and closes the sheet.
- **Reorder / remove colours:** colours within an element are ordered (drag to reorder implied); removing a colour drops that can.
- **Vendor switch:** tapping a vendor tab swaps the swatch dataset in place. A colour is identified by vendor + code, so a piece — and even a single fade — can mix brands.
- **Search:** live filter of the current vendor's colours by name or code.
- **Family filter chips:** narrow the grid to one family; "All" resets.
- **Quantity:** `−` / `+` adjust each can's count (min 1). Element "N cans" total, bottom-bar "N cans / M colours", and export totals recompute live.
- **Add element:** "+ Add custom element" / "+ Add element" appends a new element with an editable role name and an empty colour list.
- **Export:** Download PNG renders the share-preview card as an image; Copy list copies a text can-list; Share uses the native share sheet.
- **Empty vs active:** Export disabled (muted) until ≥1 colour is assigned.
- Sheet open/close: slide + fade, ~200–250ms ease-out. Backdrop dims underlying screen to ~55% `#0C0D0E`.

## State Management
- `pieceName` (string).
- `elements`: ordered list of `{ id, role, colors: [{ vendor, code, name, hex, qty }] }`. An element's `colors` may hold 1..n entries; length > 1 renders the "Fade" badge and multiple bars in the preview.
- `activeElementId`: which element the picker is adding to.
- `pickerOpen` (bool), `activeVendor` (enum), `searchQuery` (string), `activeFamily` (string | "All").
- Derived: `elementCans = Σ colors.qty` (per element); `totalCans = Σ all colors.qty`; `colourCount = total number of colour entries` (or distinct — decide per product intent; mock counts entries).
- Data: per-vendor colour arrays `{ code, name, hex, family }` from the `SprayPaintSwatches` datasets. Persist the current piece (localStorage or existing backend).

## Assets
- **No image assets** — the old title image is intentionally removed. Wordmark is a text lockup ("Palette") + a CSS ring (bordered circle). All swatches are solid colour fills.
- **Colour data:** the user's own repo `github.com/stuartcarroll/SprayPaintSwatches` — `loop_colors.xlsx` (211), `montana_gold.xlsx`, `montana_black.xlsx`, `mtn94.xlsx`, `mtn_hardcore.xlsx`, `molotow_premium.xlsx` (+ Montana WHITE, MTN Water Based available). Each row: name, product code, HEX, RGB, CMYK.
- **Fonts:** Space Grotesk, Instrument Sans, Space Mono (Google Fonts).

## Files
- `Loop Palette Redesign.dc.html` — the HTML design reference containing all four screens.
