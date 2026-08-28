# Madras Menu Studio

An internal tool for Madras Catering to generate three non-repeating, priced menu options for every occasion in a client event — welcome dinner, breakfast, mehndi, sangeet, wedding lunch, cocktail hour, dinner reception, late-night snacks, and more — across multi-day events that may blend cuisines (e.g. a Jaipuri–Hyderabadi fusion wedding). Replaces ad-hoc menu building from ~128 historical Word/PDF documents with a structured wizard and database, aimed at turning a menu enquiry into three client-ready options in under 30 minutes.

## What it does

Given an event (client, dates, tradition, one or more cuisine fusions) and, for each occasion inside it, a set of parameters — guest count, venue, service style, atmosphere, service time, price range — the app generates three distinct menu options per occasion, plus matching live-station choices and a uniform price. No non-staple dish (anything other than chai, coffee, naan, dal, rice, and similar repeatable basics) is ever repeated across the whole event.

## Stack

Next.js (React + TypeScript), a single monolith — frontend and API routes together, no separate backend service. Prisma as the ORM. Postgres via a serverless-pooled provider (Neon or Supabase). Hosted on Vercel. Auth via Auth.js (NextAuth) with its Prisma adapter. A separate one-time/periodic Python pipeline (`menu_etl_pipeline.py`) handles ingestion of the historical menu documents — it is not part of the running app.

Full rationale for these choices, including tradeoffs considered, is in [`MENU-APP-SPEC.md`](./MENU-APP-SPEC.md).

## Project structure

```
madras-menu-studio/
├── app/                      # Next.js App Router — pages and API routes
├── prisma/
│   └── schema.prisma         # Authoritative database schema
├── menu_etl_pipeline.py      # Python ETL: extract → aggregate → load (see its own docstring)
├── extracted/                # ETL intermediate output (gitignored)
├── seed/                     # ETL final output — review CSV + seed JSON (gitignored)
├── CLAUDE.md                 # Context file read automatically by Claude Code each session
├── MENU-APP-SPEC.md          # Original requirements refinement
├── DESIGN-SPEC-AND-UML.md    # ER diagram, sequence diagram, ETL flowchart
├── GETTING-STARTED.md        # Ordered setup guide, phase by phase, with the reasoning behind each step
└── WORKING-WITH-CLAUDE-CODE.md  # Token-efficient habits for building this with Claude Code
```

## Getting started

Full ordered walkthrough with the reasoning behind each step is in [`GETTING-STARTED.md`](./GETTING-STARTED.md). Short version:

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# fill in DATABASE_URL (from Neon or Supabase) and any Auth.js provider secrets

# 3. Run database migrations
npx prisma migrate dev

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

`menu_etl_pipeline.py` turns the historical menu documents into the seed data behind the dish library, in three resumable stages:

```bash
python menu_etl_pipeline.py extract   --input ./menus --output ./extracted
python menu_etl_pipeline.py aggregate --input ./extracted --output ./seed
python menu_etl_pipeline.py load      --input ./seed --database-url $DATABASE_URL
```

`extract` uses Claude to structure each inconsistent document; `aggregate` fuzzy-dedupes and categorizes the results and writes a `dish_review.csv` for a human QA pass before anything is trusted; `load` upserts the reviewed data into Postgres. See the script's own docstring for why an LLM extraction pass is used instead of dbt or a RAG index.

## Deployment

Hosted on Vercel, connected directly to this GitHub repo — pushes to `main` deploy automatically. Set the same environment variables listed above in the Vercel project settings; they are not read from `.env` in production.

## Documentation map

- [`MENU-APP-SPEC.md`](./MENU-APP-SPEC.md) — original requirements refinement: wizard steps, build order, open questions.
- [`DESIGN-SPEC-AND-UML.md`](./DESIGN-SPEC-AND-UML.md) — ER diagram, wizard sequence diagram, ETL flowchart, full schema walkthrough.
- [`GETTING-STARTED.md`](./GETTING-STARTED.md) — phase-by-phase setup guide with the reasoning behind the order.
- [`WORKING-WITH-CLAUDE-CODE.md`](./WORKING-WITH-CLAUDE-CODE.md) — how to work with Claude Code on this repo without burning tokens re-explaining context each session.
- [`CLAUDE.md`](./CLAUDE.md) — condensed project context, read automatically by Claude Code at the start of every session.

## License

Internal tool — proprietary to Madras Catering. Not published for external use.