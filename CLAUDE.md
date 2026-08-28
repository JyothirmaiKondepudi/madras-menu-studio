# Madras Menu Studio — Project Context for Claude Code

Read this fully at the start of every session; it's meant to replace re-explaining the domain each time. For anything not covered here, check the referenced docs before asking — don't re-derive from scratch.

## What this is

An internal tool for Madras Catering to generate three non-repeating, priced menu options per event occasion (welcome dinner, breakfast, mehndi, sangeet, wedding lunch, cocktail hour, dinner reception, late-night snacks, etc.), across multi-day events that may blend cuisines (e.g. a Jaipuri–Hyderabadi fusion wedding). Replaces ad-hoc menu building from ~128 historical Word/PDF docs with a structured wizard + database.

## Stack (decided — don't re-litigate without asking)

Next.js (React + TypeScript), single monolith — frontend and API routes together, no separate Express backend. Prisma as the ORM. Postgres, via a serverless-pooled provider (Neon or Supabase) — required because Prisma + serverless functions exhausts connections without pooling. Hosted on Vercel. Auth via Auth.js (NextAuth) with its Prisma adapter — magic-link or Google OAuth, no custom password handling.

Data ingestion is a separate, one-time/periodic Python pipeline (`menu_etl_pipeline.py`, three stages: `extract` → `aggregate` → `load`), not part of the running app. It uses an LLM (Claude) for structuring the inconsistent source docs — **no dbt, no RAG index** for this; both were considered and rejected as more infrastructure than this data volume needs. See that file's own docstring for how it works.

## Domain model

Authoritative schema: `prisma/schema.prisma` (or `schema-full.prisma` if not yet renamed). One line per entity:

`User` — admin/staff/chef roles. `Event` — the top-level booking (client, dates, tradition: hindu/muslim/christian/other). `CuisineProfile` — a named fusion (e.g. tags `[rajasthani, telugu_andhra]`), belongs to `Event`, reusable across its occasions. `Occasion` — one meal/function within an event (day, type, guest count, service style, price tier, which cuisine profile it uses). `PriceTier` — base per-person rate by occasion type + service style. `MenuItem` — one dish (course, veg/nonveg, cuisine tags, allergens, dietary flags, religion suitability, occasion suitability, `isStaple`, tax category). `LiveStation` — filterable live-cooking stations, same tag structure as dishes. `GeneratedMenuOption` / `GeneratedMenuOptionItem` — the actual 3 options produced per occasion, with a `locked` flag per item for the review step. `TaxCategory` — rate lives here, never on the dish itself. `DishReference` — chef-facing YouTube/prep links per dish, many per dish allowed.

## Business rules that must not be silently changed

**No-repeat ledger**: a non-staple `MenuItem` can't appear more than once across an entire `Event` (all its occasions, all 3 options each). This is a *derived query* (join `GeneratedMenuOptionItem → GeneratedMenuOption → Occasion → Event`, filter non-staple), not a stored table — don't add a separate ledger table. Staple items (`isStaple: true` — chai, coffee, naan, dal, rice, etc.) are exempt and can repeat anywhere. Occasions generate in `Occasion.sequenceOrder`, and the ledger fills as you go through that order. If a cuisine-filtered pool runs dry, surface a warning — never silently repeat a non-staple item.

**Cuisine fusion**: a `CuisineProfile` is just a tag set, owned by `Event` (not by a single `Occasion`), so it's reusable across occasions and an event can have more than one profile if different occasions need different fusions.

**Pricing**: always `PriceTier.basePerPerson` (by occasion type + service style) adjusted by the sum of `MenuItem.priceWeight` for whatever's in the option, plus `LiveStation.pricePerPerson` add-ons. Tax is computed from `TaxCategory.ratePercent` via the item's `taxCategoryId` — never hardcode a tax rate on a dish or in application code.

**Roles**: `admin` manages the dish library, tax rates, and users. `staff` creates/edits events and generates menus. `chef` is read-only on menus, plus can add `DishReference` entries — confirm the exact chef write-permission with the user before locking down API route guards, it hasn't been finalized. All authenticated users currently see all events (no per-event ACL yet).

## Repo conventions

`.env` holds `DATABASE_URL` and `ANTHROPIC_API_KEY` — never commit it, it's in `.gitignore`. `node_modules/`, `.next/`, and the ETL pipeline's `extracted/`/`seed/` output folders are also gitignored — don't re-add them. Prisma schema changes go through `prisma migrate dev`, never hand-edited SQL against the live database.

## How to work in this repo (token-efficient habits, already agreed)

Scope each session to one piece (one model, one API route, one component) — not "build the wizard." Use Plan Mode before touching more than one file or the schema. Reference specific files by path rather than asking to search "the codebase." Commit small, one feature per branch. Once tests exist for the no-repeat ledger and pricing logic, let them verify a change instead of manual back-and-forth.

## Where the fuller detail lives

`DESIGN-SPEC-AND-UML.md` — ER diagram, wizard sequence diagram, ETL flowchart, full schema walkthrough. `MENU-APP-SPEC.md` — original requirements refinement (wizard steps, build order, open questions). `menu_etl_pipeline.py` — the ingestion pipeline itself, self-documented in its module docstring.