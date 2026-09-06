# Madras Menu Studio

An internal tool for Madras Catering to generate three non-repeating, priced menu options for every occasion in a client event — welcome dinner, breakfast, mehndi, sangeet, wedding lunch, cocktail hour, dinner reception, late-night snacks, and more — across multi-day events that may blend cuisines (e.g. a Jaipuri–Hyderabadi fusion wedding). Replaces ad-hoc menu building from a historical Word/PDF/legacy-.doc archive (`menus-source/`, gitignored — proprietary business content; ~2,100 raw files as of Sept 2026, curated down to a much smaller set before any of them cost an API call — see "The data pipeline" below) with a structured wizard and database, aimed at turning a menu enquiry into three client-ready options in under 30 minutes.

## What it does

Given an event (client, dates, tradition, one or more cuisine fusions) and, for each occasion inside it, a set of parameters — guest count, venue, service style, atmosphere, service time, price range — the app generates three distinct menu options per occasion, plus matching live-station choices and a uniform price. No non-staple dish (anything other than chai, coffee, naan, dal, rice, and similar repeatable basics) is ever repeated across the whole event.

## Stack

Next.js (React + TypeScript), a single monolith — frontend and API routes together, no separate backend service. Prisma as the ORM. Postgres via a serverless-pooled provider (Neon or Supabase). Hosted on Vercel. Auth via Auth.js (NextAuth) with its Prisma adapter — **not yet built**; there is currently no login/session mechanism anywhere in the app, and every route (including `/review`, below) is unauthenticated. `User.role` (`admin`/`staff`/`chef`) exists in the schema but nothing reads it yet. A separate one-time/periodic Python pipeline (`menu_etl_pipeline.py`) handles ingestion of the historical menu documents — it is not part of the running app.

## Project structure

```
madras-menu-studio/
├── app/                      # Next.js App Router — pages and API routes
│   └── review/               # Card-grid dish review UI (approve/reject/edit staged data)
├── prisma/
│   ├── schema.prisma         # Authoritative database schema
│   └── migrations/           # One folder per migration, applied in order — see Getting started's note on 0_init
├── menu_etl_pipeline.py      # Python ETL: curate → extract → aggregate → load/(stage → promote) — see its own docstring
├── menus-source/             # Raw + curated historical documents (gitignored — proprietary business content)
├── extracted/                # ETL intermediate output (gitignored)
├── seed/                     # ETL final output — review CSV + seed JSON (gitignored)
├── CLAUDE.md                 # Context file read automatically by Claude Code each session
└── DESIGN-REFERENCE.md       # UI/visual mockup notes (colors, typography, page-by-page layout)
```

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# fill in DATABASE_URL (from Neon or Supabase) and any Auth.js provider secrets — Auth.js
# itself isn't wired up yet (see Stack above), so these can stay blank for now

# 3. Run database migrations
npx prisma migrate dev
```

> **Known issue**: the very first migration (`prisma/migrations/0_init/migration.sql`) has a
> UTF-8 BOM at the start of the file, which makes `prisma migrate dev` fail with a syntax
> error the moment it replays `0_init` against the shadow database (`ERROR: syntax error at
> or near "﻿"`) — found and worked around this session (see git history around Sept 2026).
> Do **not** just strip the BOM on a database that has already applied `0_init` — that
> changes the file's checksum and Prisma will refuse to proceed, offering `migrate reset`
> instead (which drops all data). On an existing database, use `npx prisma migrate deploy`
> for any *new* migration instead of `migrate dev` (it applies pending migrations directly,
> without the shadow-database replay that trips over this). This only needs a real fix once,
> by stripping the BOM and updating that migration's stored checksum in `_prisma_migrations`
> together — not yet done, since it wasn't this session's task.

```bash
# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dish-review card grid is at [http://localhost:3000/review](http://localhost:3000/review) once `stage` has pushed some data into it (see "The data pipeline" below) — no login required (see the auth note above).

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (use a pooled connection — see below) |
| `NEXTAUTH_SECRET` | Auth.js session encryption secret |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000` locally) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | If using Google OAuth sign-in |
| `ANTHROPIC_API_KEY` | Only needed to run the ETL pipeline's `extract` stage |

Never commit `.env` — it's gitignored. Use `.env.example` (values blanked out) to document what a new environment needs.

**Important**: Prisma opens real database connections per client, and Vercel's serverless functions can spin up many short-lived ones — use a pooled connection string (Neon and Supabase both provide one) or you'll hit connection-limit errors under real traffic.

## Core business rules

These are load-bearing — see `CLAUDE.md` for the full explanation of each, and don't change them without updating that file too.

**No-repeat ledger**: a non-staple menu item can't appear more than once across an entire event, checked via a derived query (not a stored ledger table), filled in the order occasions are generated. **Cuisine fusion**: a Cuisine Profile is a tag set belonging to the Event, not a single Occasion, so it's reusable across occasions and an event can carry more than one. **Pricing**: always the price tier's base rate adjusted by item price weights and live-station add-ons; tax is computed from a `TaxCategory` referenced by ID, never hardcoded on a dish. **Roles**: `admin` (dish library, tax rates, users), `staff` (creates/edits events and menus), `chef` (read-only, plus adding YouTube/prep reference links per dish).

## The data pipeline

`menu_etl_pipeline.py` turns the historical menu documents into the seed data behind the dish library. Six resumable stages — see the script's own docstring for the full rundown and for why an LLM extraction pass is used instead of dbt or a RAG index:

```bash
python menu_etl_pipeline.py curate    --input ./menus-source/raw --output ./menus-source/curated
python menu_etl_pipeline.py extract   --input ./menus-source/curated --output ./extracted
python menu_etl_pipeline.py aggregate --input ./extracted --output ./seed
python menu_etl_pipeline.py load      --input ./seed --database-url $DATABASE_URL
python menu_etl_pipeline.py stage     --input ./seed --database-url $DATABASE_URL
python menu_etl_pipeline.py promote   --database-url $DATABASE_URL
```

`curate` strips junk, exact-duplicate copies, non-menu document categories, and internal kitchen prep/quantity notes out of a raw source archive before anything costs an API call. `extract` uses Claude to structure each remaining document. `aggregate` fuzzy-dedupes and categorizes the results into a seed dataset. From there, two alternative review paths lead to the same live `menu_items` table: `load` goes straight from a human-reviewed `dish_review.csv` (opened in a spreadsheet); `stage` instead pushes the seed data into a `menu_item_drafts` staging table for review through the app's own `/review` page (a card grid — approve/reject/edit each dish), and `promote` upserts whatever got approved/edited there into `menu_items`. Nothing not explicitly reviewed in either path ever reaches the live table.

### Extraction cost (real numbers, Sept 2026 batch)

`extract` is the only stage that costs money (one Claude API call per document). From a real 1,108-document batch:

| Metric | Value |
|---|---|
| Total spend | ~$181 |
| Cost per document processed | ~$0.16 |
| Unique dishes after fuzzy-dedup | 4,016 |
| Cost per unique dish | ~$0.045 |
| New dishes (not already in the live catalog) | 3,176 |
| Cost per new dish | ~$0.057 |

Why per-document cost varies so much: output tokens (not input) dominate the bill, priced ~5x input — and output scales with how many distinct dishes a document contains (~200 tokens/dish), not with how polished or lengthy the source text is. A handful of "master catalog" documents (the whole company's dish list reproduced in one file, sometimes duplicated near-identically across different years' folders — not always exact-byte duplicates, so `curate`'s dedup doesn't always catch them) can each cost as much as 150-200 regular event menus. These outliers are why actual spend ran higher than a small-sample estimate would suggest — budget accordingly, and consider spot-checking a source archive for this pattern before estimating a full-batch cost from a partial sample.

## Deployment

Hosted on Vercel, connected directly to this GitHub repo — pushes to `main` deploy automatically. Set the same environment variables listed above in the Vercel project settings; they are not read from `.env` in production.

**`/review` is unauthenticated in production, same as everywhere else** (see the Auth.js note under Stack) — anyone with the URL can approve/reject/edit staged dishes. This was a deliberate short-term call to ship the review flow quickly; treat the URL as unlisted, not secret, and revisit once Auth.js exists.

## Documentation map

This section used to list `MENU-APP-SPEC.md`, `DESIGN-SPEC-AND-UML.md`, `GETTING-STARTED.md`, and `WORKING-WITH-CLAUDE-CODE.md` — none of those files actually exist in this repo (never written, or lost at some point); the links were stale and have been removed rather than left dangling. What's actually here:

- [`CLAUDE.md`](./CLAUDE.md) — condensed project context (stack, domain model, business rules, repo conventions), read automatically by Claude Code at the start of every session. The most up-to-date single source of truth for "why" questions about this project.
- [`DESIGN-REFERENCE.md`](./DESIGN-REFERENCE.md) — UI/visual mockup notes (palette, typography, page-by-page layout) captured from a Figma prototype; source of truth for visual direction until superseded.
- This README — setup, the data pipeline (including real extraction cost), deployment, and environment variables.
- `menu_etl_pipeline.py`'s own module docstring — the fullest detail on the ETL pipeline itself, including why an LLM extraction pass is used instead of dbt or a RAG index.

If a wizard-requirements doc or an ER/sequence-diagram doc gets written later, add it here.

## License

Internal tool — proprietary to Madras Catering. Not published for external use.