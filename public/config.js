// Public runtime config. The Turnstile SITE key is public by design (it ships in
// the page). Swap this for your real Turnstile site key to activate protection;
// the matching SECRET key is set as the Worker secret TURNSTILE_SECRET.
//
// Default below is Cloudflare's ALWAYS-PASSES test key — the app works
// end-to-end but provides NO real abuse protection until you swap both keys.
export const TURNSTILE_SITEKEY = '1x00000000000000000000AA';
