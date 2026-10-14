# Dragonwilds Crafting — Feature Plan

## Goals

- Players mid-game look up "how do I craft X" on phone or second monitor, find it via Google.
- Zero hosting cost; data stays current with the wiki without manual work.

## Decisions

| Topic | Decision |
|---|---|
| Base | Keep prototype (Astro static site + wiki Bucket pipeline), refine on top |
| Audience | Mid-game players, mobile + desktop equally first-class |
| Alternate recipes | User can switch recipe per ingredient; choice **remembered globally** (localStorage) and applied to every tree/total |
| Unlocks | Show required plan/pattern/vestige + skill-perk unlocks (skill + level). No pickup-unlocks (prose only on wiki) |
| Hosting | GitHub Pages |
| Data refresh | Weekly GitHub Action: sync wiki → commit `db.json` if changed → build → deploy |

## Already built (prototype)

- Wiki fetch (`scripts/fetch-wiki.mjs`) + transform (`scripts/build-data.mjs`) → `src/data/db.json`
- Search (client-side, lazy index, keyboard nav, `/` hotkey)
- Item page: recipes with station/XP, crafting tree, base-material totals, drops/shops, used-in, crafted-at-station
- Category pages grouped by station; home with categories + stations
- Sitemap, canonical/meta tags, wiki attribution

## Phases

Each phase is a vertical slice: data → UI → verified in browser.

### Phase 1 — Alternate recipe selection ✅

**Data**
- Unchanged; every item already carries all its recipes.

**Behaviour**
- Default recipe per item = first recipe (own wiki page first), same as today. Static HTML renders this default, so SEO/no-JS is unaffected.
- In the crafting tree, any node with >1 recipe gets a compact switcher (e.g. "via Furnace · 1 of 3 ▾") listing station + materials of each option.
- Choosing an option saves `{itemSlug: recipeIndex}` to localStorage and re-renders tree + totals on the current page; every other page applies it on load.
- Visible indicator when a non-default choice is active ("Using your recipe choice") + "Reset to default" per node and globally.

**Implementation sketch**
- Each item page embeds the JSON subgraph reachable from that item (all recipes of every descendant), not the whole db.
- One client module renders tree + totals from (subgraph, prefs); the server render uses the same pure function so output matches.
- Fix totals rounding at the same time: aggregate demand per intermediate across the whole tree before rounding up crafts (today it rounds per branch and overcounts).

**Edge cases**
- Choosing a recipe that creates a cycle (A ← B ← A): stop expansion at the repeat and show it as a leaf, as today.
- Stored index no longer valid after a data sync (recipe removed/reordered): store a recipe signature (station + material slugs) instead of index; fall back to default if no match.

**Done when:** switching Bronze Bar to "salvage" on the Bronze Helmet page changes the tree + totals, and persists on the Bronze Sword page.

### Phase 2 — Unlocks & requirements ✅

**Data** (`build-data.mjs`, plus fetch of `infobox_skill_perk` bucket)
- `recipe.requires`: the plan/pattern/vestige from the recipe bucket's `recipe` field (219 recipes). Strip `#anchor` suffixes; link to item page if it exists.
- `item.unlockedBy`: skill perks whose description names the item (case-insensitive, word-boundary match against item names; longest name wins to avoid "Bowl" matching "Bowl of Onions").
- Manual override file `data/overrides/unlocks.json` for wrong/missing perk matches (committed, survives syncs).

**UI**
- Recipe card: "Requires: PATTERN: Bramblemead Cape" row.
- Item header: "Unlocked at Cooking 11 — Fancy Cookware" badge.
- Plan/pattern item pages: "Unlocks recipe for: …" section (reverse link).
- Optional: build-time report listing perks that matched no item, to fix up via overrides.

**Done when:** Pan Rack shows its Cooking 11 unlock; Bramblemead Cape shows its pattern; pattern page links back.

### Phase 3 — Mobile-first polish ✅

- Audit at 375px: header (brand collapses, search full width), recipe cards, tree indentation (cap nesting indent, allow horizontal scroll), tables → stacked rows on narrow screens.
- Tap targets ≥ 44px for tree toggles and recipe switchers.
- Search results usable with on-screen keyboard open (results above the fold).
- Lighthouse pass: performance/accessibility/SEO ≥ 95 on an item page.

### Phase 4 — Automated sync + GitHub Pages deploy ✅

- Workflow `.github/workflows/deploy.yml`:
  - Triggers: weekly cron, push to `main`, manual `workflow_dispatch`.
  - Steps: install (mise/pnpm) → `pnpm wiki:sync` (cron/manual only) → if `src/data/db.json` changed, commit as a bot → `pnpm build` with `SITE`/`BASE` → deploy via `actions/deploy-pages`.
- Safety: abort commit/deploy if item or recipe count drops >10% vs. the committed data (protects against a wiki outage or schema change wiping the site).
- `fetchedAt` only changes when data changes, so no-op weeks produce no commit.

## Open questions

1. GitHub repo name/owner and whether you want a custom domain. Workflow derives URLs automatically, so this only matters for SEO/branding.
2. Unlock info on category pages / search? Implemented: item page only.
3. Decorations sharing one wiki page stay merged into one item (each recipe card shows its variant name).

## Deviations from plan

- Phase 3: no Lighthouse run (no tooling in this environment). Verified instead: zero horizontal overflow at 375px on all page types, 44px touch targets via `(pointer: coarse)`, 16px inputs (no iOS zoom), search dropdown sized with `dvh` for the on-screen keyboard.
- Phase 2: perk matching only considers perks whose text says "unlock" and only craftable items — otherwise e.g. "weight of rune essence reduced" or "stone building pieces" produced false hits.

## Out of scope (for now)

- Multi-item crafting planner / shopping list
- "What can I craft with what I have"
- Pickup-based unlocks
