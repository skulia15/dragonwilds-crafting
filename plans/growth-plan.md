# Dragonwilds Crafting — Growth & Sustainability Plan

## Constraints that shape everything

1. **Costs are ~zero today.** GitHub Pages hosting is free; the only optional cost is a custom domain (~$10–15/yr).
   "Earn enough to pay hosting" = earn ~$15/yr.
2. **Wiki licence is CC BY-NC-SA 3.0 — non-commercial.** Recipe data, descriptions and icons come from the wiki.
   Ads, paywalls or affiliate links on pages built from that data are commercial use → likely licence violation.
   Voluntary donations to cover costs are the commonly tolerated route on fan sites; ads are not.
3. **Jagex fan content policy**: fan projects may not be monetised in ways that imply endorsement or sell game
   content. Donations/tips are generally fine; review the current policy before adding any money flow.
4. **Icons are hotlinked** from the wiki. At meaningful traffic this costs the wiki bandwidth — be a good citizen
   (see Phase 3).

## Goals

| Horizon | Audience | Money |
|---|---|---|
| 1 month | Indexed by Google/Bing; first 500 visits | Custom domain paid |
| 3 months | 1–2k visits/month, recurring visitors | Donations cover domain |
| 6+ months | Recognised community tool (linked from wiki/Reddit/Discord) | Donations cover domain + small buffer |

## Phase 1 — Get found (week 1–2)

- [ ] Buy a custom domain (e.g. `dragonwildscrafting.com`); add CNAME in Pages settings. Workflow derives URLs
      automatically. Gives a root `robots.txt` location, brandable links, and keeps SEO if hosting ever moves.
- [ ] Re-add `robots.txt` once on the custom domain (it only works at the domain root).
- [ ] Google Search Console + Bing Webmaster Tools: verify (secrets already wired), submit `/sitemap-index.xml`.
- [ ] Cloudflare Web Analytics token (free, cookie-free, no consent banner) → know what people search for.
- [ ] Site-wide social preview image (1200×630) so shared links look good on Discord/Reddit.

## Phase 2 — Reach players where they are (week 2–6)

- [ ] **Reddit** r/RSDragonwilds: one launch post framed as a free tool ("crafting tree + raw-material totals for
      any item"), with a GIF of the recipe switcher. Answer crafting questions with deep links afterwards.
- [ ] **Discord**: official Dragonwilds server + large clan servers — ask mods before posting; offer a pinned link.
- [ ] **Wiki**: ask on the wiki Discord/talk pages whether an external "crafting calculator" link is welcome
      (also the right place to credit them and ask about icon bandwidth).
- [ ] **Patch days**: weekly sync already runs; trigger a manual sync on update day and post "updated for
      patch X" — timely posts get the most traffic.
- [ ] Share item-page links, not the homepage — they answer specific questions and rank for long-tail searches.

## Phase 3 — Be worth returning to (month 2–3)

Prioritised by "what makes players come back" vs. effort:

1. **Multi-item planner / shopping list** (deferred in feature plan): add items + quantities → combined raw
   materials and station checklist, saved in browser. Biggest retention feature; reuses `totals()`.
2. **Quantity input** on item pages ("I need 10 arrows") — tiny change, high value.
3. **"Where is it used" depth**: show what a raw resource ultimately becomes (reverse tree).
4. **Self-host icons** at build time (download → `public/icons/`, resized WebP). Faster pages, no wiki bandwidth
   cost, no breakage if wiki file names change. Keep attribution.
5. **Changelog page** generated from weekly data diffs ("new recipes this week") — gives a reason to revisit and
   free shareable content each patch.
6. Light **PWA** (installable, offline) for second-screen use.

## Phase 4 — Cover costs (after traction, month 3+)

- [ ] Ko-fi / GitHub Sponsors link in footer: "Free & ad-free. Tips cover the domain." Transparent cost line
      (e.g. "This year's costs: $12 — covered ✓").
- [ ] No ads, no affiliate links while the site relies on CC BY-NC-SA data.
- [ ] If revenue ever needs to exceed costs: that requires original, non-wiki content/data (own screenshots,
      guides, tools) and a fresh licence review — out of scope until then.

## Metrics to watch (Cloudflare Analytics + Search Console)

- Search impressions/clicks per item page → which recipes people look for; improve those pages first.
- Returning visitors → validates planner/retention features.
- Referrers → which community channels are worth the effort.

## Risks

| Risk | Mitigation |
|---|---|
| Wiki changes Bucket schema → sync breaks | `wiki:check` guard blocks bad deploys; Action failure emails you |
| Wiki/Jagex object to the site | Attribution is prominent; no monetisation beyond tips; ask early (Phase 2) |
| Game interest drops | Costs ~$15/yr; site keeps working with zero maintenance |
