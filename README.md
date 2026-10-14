<img src="assets/icon.svg" width="64" height="64" alt="">

# Dragonwilds Crafting

Static crafting lookup for RuneScape: Dragonwilds — search items, see recipes + crafting stations, drill into ingredients, find where raw resources come from, browse by category.

Data comes from the [Dragonwilds Wiki](https://dragonwilds.runescape.wiki/) (CC BY-NC-SA 3.0) via its Bucket API.

## Develop

```sh
mise install
pnpm install
pnpm dev
```

## Refresh wiki data

```sh
pnpm wiki:sync    # fetch (network → data/raw/, gitignored) + build (→ src/data/db.json)
pnpm wiki:build   # rebuild db.json from cached raw data only (e.g. after editing categories)
```

Category rules live in `scripts/build-data.mjs` (`CATEGORIES`, first match wins).
Skill-perk unlocks are matched from perk descriptions; fix misses/false hits in `data/overrides/unlocks.json`
(`*` wildcards allowed). `pnpm wiki:build` prints perks that say "unlock" but matched nothing.

## Build & deploy

`pnpm build` outputs a fully static site to `dist/` — one HTML page per item, plus a sitemap.
Set `SITE` (and `BASE` for a GitHub Pages project site, e.g. `/dragonwilds-crafting/`) at build time.

Deployed to GitHub Pages by `.github/workflows/deploy.yml`:

- **push to main** → build + deploy committed data
- **weekly (Mon) / manual** → `wiki:sync` → `wiki:check` (aborts if items/recipes drop >10%) → commit `db.json` if changed → build + deploy

One-time setup: repo **Settings → Pages → Source: GitHub Actions**. `SITE`/`BASE` are derived automatically, including custom domains.
