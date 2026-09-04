# Design Reference — Maharaja Catering mockup

Captured from screenshots the user shared (Figma/prototype, exact source not
in this repo — described here since the image files themselves can't be
exported from chat into this repo, only observed and written down). Treat
this as the source of truth for visual direction until superseded.

## Palette & chrome
- Near-black background (not the plum/aubergine currently used — closer to `#0a0a0a`/`#0d0a12`)
- Header: brand wordmark left ("Maharaja" in white serif + "Catering" in orange serif), logged-in username + pill "Sign Out" button on the right
- Hero/feature panels use a deep plum/purple gradient (distinct from the near-black page background), with faint decorative circular/rangoli line-art in the corner
- Primary CTA buttons: orange→gold gradient pill, dark text
- Day-column headers: maroon-brown gradient block (not plain text) with a small "DAY" label above a large day number

## Typography
- Bold, high-contrast display serif for major headings ("Maharaja", "Welcome, ...", dish/event names) — user says this reads better than Playfair Display as currently used; exact font name unknown (would normally be in the Figma file's text styles), treat as "a bolder/different serif" until user confirms a name
- Clean sans for body/meta text

## Page: Dashboard (`/events` equivalent)
- Hero card: "🙏 Namaste" small label, "Welcome, {username}" large heading, one-line subtitle, "+ Plan New Event" CTA button, decorative circular line-art on the right side of the card
- "Your Events" section below: card grid, each card shows a small muted cuisine-type tag top-left (e.g. "South Indian"), bold event name, meta line ("X Day · Y services"), and a gold "View event plan →" link at the bottom — no visible arrow-chevron affordance like the current build uses instead

## Page: New Event form
- "NUMBER OF DAYS": a row of circular number buttons (1–7), selected state = solid orange fill; helper text below ("1 day · 8 meal services total")
- "CUISINE FOCUS": a vertical list of selectable rows, each with an emoji icon, cuisine name (bold), one-line description, and a filled checkmark badge on the right when selected (e.g. North Indian / South Indian / Rajasthani / Pan-Indian / Fusion)

## Page: Event plan (day-columns)
- "← Back" + brand header
- Columns per day the event spans, each with the maroon-gradient "DAY N" header block described above
- Each column lists **named meal services**, not just occasion-type slugs — e.g. "Morning Puja & Blessings," "Breakfast Service," "Mid-Morning Snacks," "Formal Lunch," "Afternoon Tea," "Cocktail Reception," "Grand Dinner," "Late Night Bites" — implies either a friendlier display label per occasion type, or these are literally distinct occasions per day (a fuller day than currently modeled)
- Each row has a "View menus →" link

## Page: Tiered menu generation
- Breadcrumb-style subtitle above the title: "{event} · Day {n} · {cuisine}"
- Big title = the meal service name, one-line subtitle ("3 curated menu options — choose the one that fits your vision")
- Legend: 🟢 Vegetarian / 🔴 Non-Vegetarian
- Three tier cards side by side, each with a small label + tier name ("★ Bronze · Classic"), price per person, and a dish count ("7 dishes included")
- **Dishes are grouped under bold course-section headers** (e.g. "MORNING SPREAD," "STARTERS," "SIDES," "SWEETS") — not a flat list with the course name in parentheses next to each dish
- Each dish row: green/red dot indicator, dish name (bold), and **a one-line description underneath the name** in smaller muted text (e.g. "Puri Bhaji" / "Puffed fried bread with spiced potato curry")
- Bottom of each card: a "Select {Tier} Menu" button, colored per tier (orange for the cheapest, gray/neutral for mid, gold for premium)

## Known gaps against the current schema/data
- `MenuItem` has no `description` field — the mockup's per-dish blurbs need either a schema addition + a generation pass (e.g. one LLM call to write a short description per existing dish name), or sourcing from documents that don't actually contain them
- No "selected tier" concept exists yet on `Occasion`/`GeneratedMenuOption` — the "Select {Tier} Menu" button has nothing to persist to without a small schema addition
- The "named meal services" (Morning Puja & Blessings, etc.) go beyond the current `occasionType` enum-style values — would need either a friendlier label mapping or a real per-occasion custom name field
