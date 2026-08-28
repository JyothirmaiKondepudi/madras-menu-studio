# Madras Catering Menu Generator — Design Spec & UML

This consolidates every decision made so far into one reference: the data model (as an ER diagram and the full Prisma schema), the wizard/generation flow (as a sequence diagram), and the ETL pipeline (as a flowchart). Diagrams are Mermaid — they render natively on GitHub, so this file can live in the repo as-is.

## 1. Decisions this reflects

Stack: Next.js (React + TypeScript) as a single monolith — frontend and API routes together, not a separate Express backend — using Prisma as the ORM against Postgres, hosted on Vercel with a serverless-pooled Postgres provider (Neon or Supabase). Data pipeline: a three-stage Python ETL (`extract` → `aggregate` → `load`) turns the 128 historical menu docs into seed data, using an LLM for structuring rather than dbt, since the categorization logic is simple enough to live as plain code at this data volume. No RAG index — this is one-time structured extraction, not query-time retrieval.

Multi-user access: three roles — `admin` (dish library, tax rates, user management — you), `staff` (create/edit events and generate menus), `chef` (read-only on generated menus, plus adding/viewing the YouTube reference links below). All authenticated users see all events; this is a small internal team, not a client-facing multi-tenant system, so there's no per-event sharing/permission model yet — every `Event` just records who created it (`createdByUserId`) for accountability, not access control. Auth itself isn't custom-built: recommend Auth.js (formerly NextAuth) with its official Prisma adapter, using either magic-link email sign-in or Google OAuth if your team already uses Google Workspace — both skip building password reset/hashing yourself.

Chef references: dishes can carry reference links (YouTube prep videos, plating walkthroughs) via a separate `DishReference` table rather than a single URL field on `MenuItem`, so a dish can have more than one link (e.g. "prep" and "plating" as separate entries), each one tracked to whoever added it.

## 2. Data model (ER diagram)

```mermaid
erDiagram
    USER ||--o{ EVENT : creates
    USER ||--o{ DISH_REFERENCE : adds
    EVENT ||--o{ OCCASION : has
    EVENT ||--o{ CUISINE_PROFILE : defines
    CUISINE_PROFILE ||--o{ OCCASION : "used by"
    PRICE_TIER ||--o{ OCCASION : "priced at"
    OCCASION ||--o{ GENERATED_MENU_OPTION : generates
    OCCASION }o--o{ LIVE_STATION : selects
    GENERATED_MENU_OPTION ||--o{ GENERATED_MENU_OPTION_ITEM : contains
    MENU_ITEM ||--o{ GENERATED_MENU_OPTION_ITEM : "referenced by"
    MENU_ITEM ||--o{ DISH_REFERENCE : "has chef references"
    TAX_CATEGORY ||--o{ MENU_ITEM : "taxes"

    USER {
        uuid id PK
        string name
        string email
        string role "admin | staff | chef"
    }

    DISH_REFERENCE {
        uuid id PK
        uuid menuItemId FK
        uuid addedByUserId FK
        string url "YouTube prep/plating link"
        string label
    }

    EVENT {
        uuid id PK
        uuid createdByUserId FK
        string clientName
        string eventName
        string tradition "hindu | muslim | christian | other"
        date startDate
        date endDate
    }

    CUISINE_PROFILE {
        uuid id PK
        uuid eventId FK
        string name "e.g. Jaipuri-Hyderabadi Fusion"
        string[] cuisineTags "base cuisine tags in the fusion"
    }

    OCCASION {
        uuid id PK
        uuid eventId FK
        uuid cuisineProfileId FK
        uuid priceTierId FK
        int dayNumber
        int sequenceOrder "generation order, feeds the no-repeat ledger"
        string occasionType "welcome_dinner | breakfast | mehndi | sangeet | wedding_lunch | cocktail_hour | dinner_reception | late_night_snacks"
        int guestCount
        string venue
        string serviceType "plated | buffet | family_style | stations"
        datetime serviceTime
        string atmosphere
        string vegNonvegRatio
    }

    PRICE_TIER {
        uuid id PK
        string name "Classic | Premium | Luxury"
        string occasionType
        string serviceStyle
        decimal basePerPerson
    }

    MENU_ITEM {
        uuid id PK
        uuid taxCategoryId FK
        string name
        string course
        string vegNonveg
        string[] cuisineTags
        string priceWeight "light | standard | premium"
        boolean isStaple "bypasses the no-repeat ledger"
        string[] allergens
        string[] dietaryFlags
        string[] religionSuitability
        string[] occasionSuitability
        string spiceLevel
        string prepMethod
        decimal costPerPerson "COGS, not client price"
        boolean active
    }

    LIVE_STATION {
        uuid id PK
        string name
        string region
        string vegNonveg
        decimal pricePerPerson
        string[] equipmentNeeded
    }

    GENERATED_MENU_OPTION {
        uuid id PK
        uuid occasionId FK
        int optionNumber "1, 2, or 3"
        decimal computedPricePerPerson
    }

    GENERATED_MENU_OPTION_ITEM {
        uuid id PK
        uuid generatedMenuOptionId FK
        uuid menuItemId FK
        boolean locked "user locked this item during review"
    }

    TAX_CATEGORY {
        uuid id PK
        string name "prepared_food | alcohol | equipment_rental | service_labor"
        string jurisdiction
        decimal ratePercent
        date effectiveDate
    }
```

Notable design choices baked into this model:

The **no-repeat ledger is a derived query, not a stored table** — "which non-staple items has this event already used" is answered by joining `GENERATED_MENU_OPTION_ITEM → GENERATED_MENU_OPTION → OCCASION → EVENT` and filtering to non-staple `MENU_ITEM`s, scoped to the event, ordered by `Occasion.sequenceOrder`. Storing it separately would just be state that can drift out of sync with the real data.

A **Cuisine Profile belongs to the Event, not a single Occasion** — that's what lets one event carry a "Jaipuri-Hyderabadi Fusion" profile used by most occasions while a specific occasion (say, the mehndi) points at a second profile if you add one, per the multi-fusion requirement from earlier.

**Tax lives on its own table, referenced by name/ID from `MENU_ITEM`** — never a rate stored per dish — so a rate change is one row update, not a rewrite across the whole item library.

## 3. Wizard & generation flow (sequence diagram)

```mermaid
sequenceDiagram
    actor User
    participant UI as Wizard UI (Next.js)
    participant API as API Routes
    participant Engine as Menu Generation Engine
    participant DB as Postgres (via Prisma)

    User->>UI: Step 1-2 — event shell + occasion map
    UI->>API: POST /events, POST /occasions
    API->>DB: insert Event, CuisineProfile, Occasion rows

    User->>UI: Step 3 — per-occasion parameters
    UI->>API: PATCH /occasions/:id
    API->>DB: update Occasion (guestCount, serviceType, priceTier, ...)

    User->>UI: Step 4 — click Generate
    UI->>API: POST /occasions/:id/generate
    API->>Engine: generateOptions(occasion)
    Engine->>DB: query used non-staple items for this Event (the ledger)
    Engine->>DB: query eligible MenuItems (cuisineProfile ∩ vegNonveg ∩ priceTier) minus ledger
    Engine->>Engine: assemble 3 non-overlapping option sets
    alt eligible pool too small
        Engine-->>API: warning — pool exhausted, suggest widening cuisine tags
    else pool sufficient
        Engine->>DB: insert GeneratedMenuOption + GeneratedMenuOptionItem rows
    end
    Engine-->>API: 3 GeneratedMenuOptions
    API-->>UI: return options
    UI-->>User: Step 5 — review, lock/swap/regenerate

    User->>UI: Step 6 — export
    UI->>API: GET /events/:id/export
    API->>DB: fetch all occasions + locked-in options + computed pricing
    API-->>UI: client-ready document
```

## 4. ETL pipeline (flowchart)

```mermaid
flowchart LR
    A[128 historical .docx / .pdf menus] --> B["extract — Claude structured extraction, one doc at a time (resumable)"]
    B --> C[Per-doc JSON in ./extracted]
    C --> D["aggregate — fuzzy dedupe + categorize (plain Python, no dbt)"]
    D --> E[dish_review.csv — human QA pass]
    D --> F[menu_items_seed.json]
    F --> G["load — upsert into Postgres via prisma/schema.prisma tables"]
    G --> H[(Postgres: menu_items, tax_categories)]
```

## 5. Full Prisma schema

This supersedes the earlier `schema.prisma`, which only covered the two tables the ETL pipeline writes to (`MenuItem`, `TaxCategory`). The full application needs the rest of the model above — see `schema-full.prisma` alongside this file. The ETL `load` step still only touches `menu_items` and `tax_categories`; the wizard's own API routes own `Event`, `CuisineProfile`, `Occasion`, `PriceTier`, `LiveStation`, and the `GeneratedMenuOption*` tables.

## 6. Open items this design intentionally leaves for later

`GeneratedMenuOption` doesn't yet version history (e.g., "what did option 2 look like before I swapped a dish") — add an audit table if you want that later. Live station pricing is treated as a flat per-person add-on; if stations end up needing tiered pricing like menu items do, `LiveStation` will want its own `priceWeight`-style field. Per-event sharing/permissions (restricting a specific event to specific staff) isn't modeled — everyone with an account currently sees every event; add an `EventCollaborator` join table if that ever needs to be locked down. And the `chef` role's actual write scope isn't nailed down yet — the schema lets any authenticated user create a `DishReference`, so decide whether that should be chef-only, staff-and-up, or open to everyone before you wire up the permission checks in the API routes.