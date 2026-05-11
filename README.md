# Wave · Tabaski ndaanaan 2026 — Spinning Wheel

Production build of the Wave Tabaski 2026 spin-to-win campaign (live **11 May → 25 May 2026**, Africa/Dakar).
Mobile-first single-page experience reached by scanning a QR code: the user lands directly on the wheel, gets up to 2 spins/day (8 total), and wins one of four Tabaski gifts (Sac shopping, Tablier, Éventail, Gourde) or a “try again tomorrow” outcome.

> This branch ships **chunk 1** of the build (visual scaffold + mocked spin API). Inventory persistence, rate-limiting, anti-abuse and supervisor redemption land in subsequent chunks.

## Stack

- **Next.js 14 (App Router) + TypeScript**
- **Tailwind CSS** for layout utilities; brand tokens are CSS variables in `app/globals.css` (ported verbatim from the design prototype)
- **Framer Motion** for the 4.2 s `cubic-bezier(0.16, 1, 0.3, 1)` wheel spin and bottom-sheet modal transitions
- **Upstash Redis** (planned, chunk 2) for spin state, inventory and idempotency
- **PostHog** (planned, chunk 5) for analytics
- Deploy target: **Vercel**

## What’s shipped so far

- `/` — Wheel screen, mobile-first, identical brand tokens to the prototype
  - Live Dakar date/time stamp in the topbar
  - Wheel SVG with 5 × 72° segments, butter pegs, violet hub ring, dotted overlay on the violet segment
  - Spin animation respects `prefers-reduced-motion`
  - **Geofenced**: the wheel only activates inside the radius of a configured site. Users out of range see the nearest active sites with directions; users who deny location permission see a clear retry screen.
- 3 bottom-sheet modals (Win / Lose / Daily-cap) with grabber affordance and slide-up animation
- `/supervisor` — password-gated panel for the campaign chief & on-site supervisors
  - Global stock (Sacs / Tabliers / Éventails / Gourdes) — current/initial, progress bar, inline editor
  - Per-site rows with: wins on/off toggle, today’s + total spins/wins, GPS coordinates editor with "use my current location" button, configurable radius (default 100 m)
  - 5 sites: Marché 1–4 + Camion itinérant (the truck is a placeholder pending its location-publishing flow)
- `/conditions` — placeholder T&Cs (each section flagged `[Placeholder — ATL à remplir]`)
- `/api/spin` — server-side weighted draw + atomic global-stock decrement + per-site tallies (in-process backing for now; Upstash Redis in chunk 2)
- `/api/check-location` — non-mutating "am I at a site?" probe used by the wheel page to greet users with their site name

The prototype’s floating dev-nav has been **stripped** as required.

### Single QR + geolocation flow

A single QR (`https://<your-domain>/`) is enough — geofencing routes the spin to the right site. The user must allow browser location; the server matches the lat/lng to the closest configured site within its radius. If they’re not in range, they see a list of the nearest active sites with "Open in Maps" links.

Supervisors set each site’s GPS coordinates from the panel (one tap on "Utiliser ma position actuelle" while standing at the site) or by entering lat/lng manually. Until a site has coordinates, no user can match it.

## Coming in later chunks

| Chunk | Scope |
| --- | --- |
| 2 | Real `/api/spin`: Upstash Redis + Lua atomic decrement, signed cookie identity, daily/total caps, inventory, idempotency key |
| 3 | Rate-limiting (1 req/s per cookie, 30 req/min per IP), bot heuristics, spin-attempt audit log |
| 4 | `/supervisor` redemption panel (deferred per ATL — “build later”) |
| 5 | Analytics (page_view / spin_attempted / spin_won / spin_lost / daily_cap_hit), UTM capture, README finalization |

## Local development

```bash
npm install
cp .env.example .env.local      # edit secrets as needed
npm run dev                      # http://localhost:3000
```

### Useful scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
npm run start       # serve production build
```

## Environment variables

All tunables (caps, weights, stock, campaign dates, Redis/PostHog credentials) live in `.env.example`. Copy to `.env.local` for development; configure the same keys as Vercel project envs for production.

Notable defaults:

| Var | Default | Notes |
| --- | --- | --- |
| `SPIN_MAX_PER_DAY` | `2` | Per the brief |
| `SPIN_MAX_TOTAL` | `8` | Per the brief |
| `SPIN_WEIGHTS` | `25,10,10,5,50` | Base probabilities `sac, tablier, eventail, gourde, lose` — wired in chunk 2 |
| `PRIZE_STOCK_*` | `1500 / 600 / 600 / 500` | Total inventory for the 16-day campaign |
| `PRIZE_DAILY_CAP_*` | `100 / 40 / 40 / 35` | Soft caps so stock doesn’t deplete in the first 3 days; tune from real day-1 data |
| `CAMPAIGN_START` / `CAMPAIGN_END` | `2026-05-11` / `2026-05-25` | Africa/Dakar |

## Deploy to Vercel

1. Push this branch to GitHub.
2. In Vercel, **Import Project** from this repo. Framework auto-detects as Next.js 14.
3. Add the env vars from `.env.example` under **Settings → Environment Variables**.
4. (Chunk 2+) Provision Upstash Redis from the Vercel Marketplace; the integration sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically.
5. (Chunk 4+) Set `SUPERVISOR_PASSWORD` to a strong shared secret distributed to on-site supervisors.

## Supervisor access (planned, chunk 4)

Per ATL confirmation, the user-facing flow shows **no code** — winners simply show their phone screen to an on-site supervisor for fulfillment. The deferred `/supervisor` page will be a thin admin view (shared env-var password) where supervisors can log redemptions and view daily totals.

## Repository layout

```
app/
  layout.tsx            # fonts, metadata, viewport
  page.tsx              # wheel screen (Client Component)
  globals.css           # brand tokens + base styles ported from the prototype
  api/spin/route.ts     # POST — mocked in chunk 1, real in chunk 2
  conditions/page.tsx   # T&Cs placeholder
components/
  Wheel.tsx             # SVG geometry + Framer Motion spin
  Topbar.tsx            # logo + live datetime + chance dots
  Footer.tsx
  Modal.tsx             # bottom-sheet container
  PrizeArt.tsx          # win/lose/cap modal illustrations
lib/
  prizes.ts             # prize + segment definitions (shared SSR/client)
  spin.ts               # outcome logic (testable)
public/
  penguin.png           # wheel hub artwork
  payez-avec-wave.png   # wordmark used in topbar + footer
reference/
  Tabaski_Wheel.html    # original design prototype (source of truth)
```
