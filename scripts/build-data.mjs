// Shapes data/raw/*.json (from fetch-wiki.mjs) into src/data/db.json for the site.
// Pure transform, no network — safe to re-run while tweaking categories.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const RAW = new URL("../data/raw/", import.meta.url);
const OUT = new URL("../src/data/db.json", import.meta.url);
const load = async (name) => JSON.parse(await readFile(new URL(`${name}.json`, RAW), "utf8"));

const [rawItems, rawRecipes, rawDrops, rawStores, rawPerks, pages, meta] = await Promise.all(
	["items", "recipes", "drops", "stores", "perks", "pages", "meta"].map(load),
);
const unlockOverrides = JSON.parse(await readFile(new URL("../data/overrides/unlocks.json", import.meta.url), "utf8"));

const BUILD_MENU = "Build Menu";

// Recipe/infobox names are free text: typos and variants ("Naptha", "Ascension Shard (Power Level 4)")
// redirect to one canonical page, which is our item key.
const canonical = (name) => pages[name]?.title ?? name;

const slugify = (s) =>
	s
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

// "[[File:Bronze Bar.png|30px|link=Bronze Bar]]" → "Bronze Bar.png"
const fileFromWikitext = (s) => (typeof s === "string" ? s.match(/\[\[File:([^|\]]+)/)?.[1]?.trim() : undefined);

const toInt = (v, fallback = 1) => {
	const n = Number.parseInt(String(v ?? "").replace(/,/g, ""), 10);
	return Number.isFinite(n) ? n : fallback;
};

/** @type {Map<string, any>} canonical title → item */
const items = new Map();
function item(name) {
	const key = canonical(name);
	let it = items.get(key);
	if (!it) {
		it = {
			name: key,
			wiki: key,
			icon: null,
			type: null,
			description: "",
			extract: pages[name]?.extract ?? pages[key]?.extract ?? "",
			builtInMenu: false,
			recipes: [],
			usedIn: new Set(),
			unlockedBy: [],
			drops: [],
			shops: [],
		};
		items.set(key, it);
	}
	return it;
}

// Infoboxes: a page can hold several versions (e.g. trimmed/untrimmed cape); first one wins.
for (const row of rawItems) {
	const it = item(row.page_name);
	if (it.type) continue;
	const j = JSON.parse(row.json);
	it.type = row.item_type?.trim() || null;
	it.description = j.description ?? "";
	it.icon = j.image_raw ?? fileFromWikitext(j.image) ?? null;
}

// Recipes
const seenRecipes = new Set();
const facilities = new Set();
for (const row of rawRecipes) {
	const j = JSON.parse(row.json);
	const outName = j.output?.name;
	if (!outName) continue;
	const sig = JSON.stringify([j.facility, outName, j.output.quantity, j.materials?.map((m) => [m.name, m.quantity])]);
	if (seenRecipes.has(sig)) continue;
	seenRecipes.add(sig);

	const out = item(outName);
	out.icon ??= fileFromWikitext(j.output.image) ?? null;
	const station = j.facility?.trim() || null;
	if (station === BUILD_MENU) out.builtInMenu = true;
	else if (station) facilities.add(canonical(station));

	const materials = (j.materials ?? [])
		.filter((m) => m.name)
		.map((m) => {
			const mat = item(m.name);
			mat.icon ??= fileFromWikitext(m.image) ?? null;
			mat.usedIn.add(out.name);
			return { key: mat.name, label: m.name, qty: toInt(m.quantity), icon: fileFromWikitext(m.image) ?? null };
		});

	out.recipes.push({
		// Recipes stored on the item's own page are the "main" ones; sorted first below.
		own: canonical(row.page_name) === out.name,
		station,
		outputLabel: outName,
		outputQty: toInt(j.output.quantity),
		// Plan/pattern/vestige that must be found first; may carry a "#Recipe location" anchor.
		requires: j.recipe?.split("#")[0].trim() || null,
		skills: (j.skills ?? []).filter((s) => s.name).map((s) => ({ name: s.name, xp: toInt(s.experience, 0) })),
		materials,
		// Content hash, not index: a saved "use this recipe" choice must survive re-syncs that reorder recipes.
		id: createHash("sha1")
			.update(JSON.stringify([station, outName, materials.map((m) => [m.key, m.qty])]))
			.digest("hex")
			.slice(0, 10),
	});
}
// Array#sort is stable, so wiki order is kept within each group.
for (const it of items.values()) it.recipes.sort((a, b) => Number(b.own) - Number(a.own));

// Drops (the bucket's "Drop type" is always "combat", so it's not shown)
for (const row of rawDrops) {
	const j = JSON.parse(row.json);
	const name = row.item_name || j["Dropped item"];
	if (!name || !items.has(canonical(name))) continue;
	item(name).drops.push({
		source: j["Dropped from"] ?? row.page_name,
		qty: String(j["Drop Quantity"] ?? ""),
		rarity: String(j.Rarity ?? ""),
	});
}

// Shops: Mode "sell" = merchant sells to the player (an acquisition source); "buy" isn't.
for (const row of rawStores) {
	const j = JSON.parse(row.sold_item_json);
	if (j.Mode !== "sell" || !row.sold_item || !items.has(canonical(row.sold_item))) continue;
	item(row.sold_item).shops.push({
		seller: j["Sold by"] ?? row.page_name,
		cost: j.Cost ?? null,
		currency: j.Currency ?? null,
	});
}

// Categories. Wiki item_type is inconsistent (Leather is a "Basic Item", capes are "Armour"),
// so name patterns take precedence over type. Order matters: first match wins.
const CATEGORIES = [
	{ slug: "crafting-stations", name: "Crafting Stations", match: (it) => facilities.has(it.name) },
	{ slug: "buildings", name: "Buildings & Decor", match: (it) => it.builtInMenu && !it.type },
	{ slug: "vestiges", name: "Vestiges", match: (it) => it.type === "Vestige" },
	{ slug: "packs", name: "Packs & Containers", match: (it) => it.type === "Container" },
	{ slug: "patterns", name: "Patterns", match: (it) => it.type === "Pattern" },
	{ slug: "quest", name: "Quest Items", match: (it) => it.type === "Quest Item" },
	{ slug: "capes", name: "Capes", match: (it) => it.type === "Cape" || /\b(cape|cloak)\b/i.test(it.name) },
	{ slug: "weapons", name: "Weapons", match: (it) => /Weapon$|^Bow$/.test(it.type ?? "") },
	{ slug: "ammunition", name: "Ammunition", match: (it) => /^(Arrow|Ammo)$/.test(it.type ?? "") },
	{
		slug: "armour",
		name: "Armour & Shields",
		match: (it) =>
			/Armour$|^Shield$/.test(it.type ?? "") ||
			/\b(shield|hat|helmet|hood|cowl|leggings|tunic|scarf|boots|gloves|shroud)\b/i.test(it.name),
	},
	{ slug: "tools", name: "Tools", match: (it) => it.type === "Tool" },
	{
		slug: "jewellery",
		name: "Jewellery & Trinkets",
		match: (it) => it.type === "Trinket" || /\b(ring|amulet|necklace|emblem)\b/i.test(it.name),
	},
	{ slug: "leathers", name: "Leathers", match: (it) => /\bleather\b/i.test(it.name) },
	{ slug: "cloth", name: "Cloth & Thread", match: (it) => /\b(cloth|thread|weave|fibres)\b/i.test(it.name) },
	{ slug: "bars", name: "Bars & Metals", match: (it) => /\b(bar|leaf)$/i.test(it.name) },
	{ slug: "potions", name: "Potions", match: (it) => it.type === "Potion" },
	{ slug: "food", name: "Food & Drink", match: (it) => /^(Food|Drink|Raw Ingredient)$/.test(it.type ?? "") },
	{ slug: "runes", name: "Runes", match: (it) => it.type === "Rune" },
	{ slug: "seeds", name: "Seeds", match: (it) => it.type === "Seed" || /\bseeds?$/i.test(it.name) },
	{ slug: "materials", name: "Materials", match: () => true },
];

// Skill perks → items they unlock. The wiki only names the item in prose, so: consider perks that
// say "unlock", match craftable item names as whole words (optional plural), longest match wins
// ("Bowl of Onions" beats "Bowl"). Fix misses/false hits in data/overrides/unlocks.json.
const stripTags = (s) => s.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const craftableNames = [...items.values()].filter((it) => it.recipes.length).map((it) => it.name);
const perkMatchers = craftableNames.map((name) => ({ name, re: new RegExp(`\\b${escapeRe(name)}(?:e?s)?\\b`, "gi") }));
const unmatchedPerks = [];
function expandOverride(patterns = []) {
	return patterns.flatMap((p) => {
		const re = new RegExp(`^${p.split("*").map(escapeRe).join(".*")}$`, "i");
		const found = craftableNames.filter((n) => re.test(n));
		if (!found.length) throw new Error(`unlocks override "${p}" matches no craftable item`);
		return found;
	});
}
for (const row of rawPerks) {
	for (const perk of JSON.parse(row.json)) {
		const description = stripTags(perk.description ?? "");
		const hits = [];
		if (/unlock/i.test(description)) {
			for (const { name, re } of perkMatchers) {
				for (const m of description.matchAll(re)) hits.push({ name, start: m.index, end: m.index + m[0].length });
			}
		}
		const kept = hits.filter((h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start));
		const names = new Set(kept.map((h) => h.name));
		for (const n of expandOverride(unlockOverrides.add[perk.name])) names.add(n);
		for (const n of expandOverride(unlockOverrides.remove[perk.name])) names.delete(n);
		if (!names.size && /unlock/i.test(description)) unmatchedPerks.push(`${perk.name}: ${description}`);
		const level = Number.parseInt(perk.level, 10);
		for (const n of names) {
			items.get(n).unlockedBy.push({
				perk: perk.name,
				skill: perk.skill,
				level: Number.isFinite(level) ? level : null,
				description,
			});
		}
	}
}

// Stable, collision-free slugs.
const usedSlugs = new Set();
const slugOf = new Map();
for (const name of [...items.keys()].sort()) {
	const base = slugify(name) || "item";
	let slug = base;
	for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
	usedSlugs.add(slug);
	slugOf.set(name, slug);
}

const out = [...items.values()]
	.map((it) => ({
		slug: slugOf.get(it.name),
		name: it.name,
		wiki: it.wiki,
		icon: it.icon ?? pages[it.name]?.image ?? null,
		type: it.type,
		category: CATEGORIES.find((c) => c.match(it)).slug,
		description: it.description,
		extract: it.extract,
		recipes: it.recipes.map(({ own, station, ...r }) => ({
			...r,
			station: station && {
				name: station,
				slug: station === BUILD_MENU ? null : (slugOf.get(canonical(station)) ?? null),
			},
			materials: r.materials.map(({ key, ...m }) => ({ ...m, slug: slugOf.get(key) })),
			requires: r.requires && { label: r.requires, slug: slugOf.get(canonical(r.requires)) ?? null },
		})),
		usedIn: [...it.usedIn].map((n) => slugOf.get(n)).sort(),
		drops: it.drops,
		shops: it.shops,
		unlockedBy: it.unlockedBy,
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

// Display order differs from match order: what players browse most comes first.
const DISPLAY_ORDER = [
	"weapons",
	"armour",
	"tools",
	"ammunition",
	"capes",
	"jewellery",
	"leathers",
	"cloth",
	"bars",
	"materials",
	"potions",
	"food",
	"runes",
	"crafting-stations",
	"buildings",
	"seeds",
	"quest",
	"patterns",
	"packs",
	"vestiges",
];
const categories = CATEGORIES.toSorted((a, b) => DISPLAY_ORDER.indexOf(a.slug) - DISPLAY_ORDER.indexOf(b.slug)).map(({ slug, name }) => {
	const members = out.filter((i) => i.category === slug);
	return { slug, name, count: members.length, craftable: members.filter((i) => i.recipes.length).length };
}).filter((c) => c.count);

// Keep the previous timestamp when nothing changed, so a no-op weekly sync produces no git diff.
const previous = await readFile(OUT, "utf8")
	.then((s) => JSON.parse(s))
	.catch(() => null);
const unchanged = previous && JSON.stringify([previous.categories, previous.items]) === JSON.stringify([categories, out]);
const fetchedAt = unchanged ? previous.fetchedAt : meta.fetchedAt;
await writeFile(OUT, `${JSON.stringify({ fetchedAt, categories, items: out }, null, "\t")}\n`);
console.log(
	`${out.length} items, ${out.filter((i) => i.recipes.length).length} craftable → src/data/db.json${unchanged ? " (unchanged)" : ""}`,
);
console.table(categories);
const unlockCount = out.filter((i) => i.unlockedBy.length).length;
console.log(`${unlockCount} items unlocked by skill perks; unmatched "unlock" perks (consider overrides):`);
for (const p of unmatchedPerks) console.log(`  - ${p}`);
