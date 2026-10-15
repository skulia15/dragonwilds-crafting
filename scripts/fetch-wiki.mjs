// Pulls raw structured data from the RuneScape: Dragonwilds wiki into data/raw/.
// Network only — all shaping happens in build-data.mjs so it can be re-run offline.
import { mkdir, writeFile } from "node:fs/promises";

const API = "https://dragonwilds.runescape.wiki/api.php";
// Wiki asks for a descriptive UA on API access.
const USER_AGENT = "dragonwilds-crafting/0.1 (static crafting lookup; github.com/skuli)";
const OUT_DIR = new URL("../data/raw/", import.meta.url);
const PAGE_SIZE = 5000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
	const url = new URL(API);
	for (const [k, v] of Object.entries({ format: "json", ...params })) url.searchParams.set(k, v);
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
		if (res.ok) {
			const body = await res.json();
			if (body.error) throw new Error(`${body.error.code}: ${body.error.info}`);
			return body;
		}
		if (attempt >= 4) throw new Error(`HTTP ${res.status} for ${url}`);
		await sleep(1000 * attempt);
	}
}

async function bucket(name, fields) {
	const rows = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const select = fields.map((f) => `'${f}'`).join(",");
		const query = `bucket('${name}').select(${select}).limit(${PAGE_SIZE}).offset(${offset}).run()`;
		const { bucket: page } = await api({ action: "bucket", query });
		rows.push(...page);
		if (page.length < PAGE_SIZE) return rows;
	}
}

// Intro extract + redirect target + lead image for each title, 20 per request (exlimit cap).
async function pageInfo(titles) {
	const out = {};
	const unique = [...new Set(titles)].filter(Boolean);
	for (let i = 0; i < unique.length; i += 20) {
		const batch = unique.slice(i, i + 20);
		const { query } = await api({
			action: "query",
			prop: "extracts|pageimages",
			exintro: "1",
			explaintext: "1",
			exlimit: "20",
			piprop: "name",
			redirects: "1",
			titles: batch.join("|"),
		});
		const normalized = Object.fromEntries((query.normalized ?? []).map((n) => [n.from, n.to]));
		const redirects = Object.fromEntries((query.redirects ?? []).map((r) => [r.from, r.to]));
		const byTitle = Object.fromEntries(Object.values(query.pages ?? {}).map((p) => [p.title, p]));
		for (const requested of batch) {
			const norm = normalized[requested] ?? requested;
			const page = byTitle[redirects[norm] ?? norm];
			if (!page) continue;
			out[requested] = {
				title: page.title,
				missing: "missing" in page,
				extract: page.extract ?? "",
				image: page.pageimage ?? null,
			};
		}
		process.stdout.write(`\r  page info ${Math.min(i + 20, unique.length)}/${unique.length}`);
		await sleep(150);
	}
	process.stdout.write("\n");
	return out;
}

// Combat stats live only in page wikitext ({{Infobox Weapon}}, {{Infobox Armour}}, …), not in a bucket.
// Keep just those templates' params, keyed by page title.
const parseTemplate = (body) =>
	Object.fromEntries(
		body
			.split(/\n\s*\|/)
			.slice(1)
			.map((p) => p.split("=").map((s) => s.trim()))
			.filter(([k, ...v]) => k && v.join("=").length)
			.map(([k, ...v]) => [k.toLowerCase(), v.join("=").replace(/<!--.*?-->/gs, "").trim()]),
	);
async function pageStats(titles) {
	const out = {};
	const unique = [...new Set(titles)];
	for (let i = 0; i < unique.length; i += 50) {
		const { query } = await api({
			action: "query",
			prop: "revisions",
			rvprop: "content",
			rvslots: "main",
			titles: unique.slice(i, i + 50).join("|"),
		});
		for (const page of Object.values(query.pages ?? {})) {
			const text = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
			for (const m of text.matchAll(/\{\{\s*Infobox (Weapon|Armour|Shield|Trinket|Tool)\b([^]*?)\n\s*\}\}/gi)) {
				out[page.title] ??= { template: m[1], ...parseTemplate(m[2]) };
			}
		}
		process.stdout.write(`\r  stats ${Math.min(i + 50, unique.length)}/${unique.length}`);
		await sleep(150);
	}
	process.stdout.write("\n");
	return out;
}

await mkdir(OUT_DIR, { recursive: true });

console.log("Fetching buckets…");
const items = await bucket("infobox_item", ["page_name", "item_type", "json"]);
const recipes = await bucket("recipe", ["page_name", "json"]);
const drops = await bucket("dropsline", ["page_name", "item_name", "json"]);
const stores = await bucket("storeline", ["page_name", "sold_item", "sold_item_json"]);
const perks = await bucket("infobox_skill_perk", ["page_name", "json"]);
console.log(
	`  items ${items.length}, recipes ${recipes.length}, drops ${drops.length}, stores ${stores.length}, perks ${perks.length}`,
);

const titles = [
	...items.map((i) => i.page_name),
	...recipes.flatMap((r) => {
		const j = JSON.parse(r.json);
		// `recipe` = required plan/pattern/vestige, sometimes with a "#section" anchor.
		return [j.facility, j.output?.name, j.recipe?.split("#")[0], ...(j.materials ?? []).map((m) => m.name)];
	}),
];
console.log("Fetching page info…");
const pages = await pageInfo(titles);
console.log("Fetching stats…");
const stats = await pageStats(items.map((i) => i.page_name));

for (const [name, data] of Object.entries({ items, recipes, drops, stores, perks, pages, stats })) {
	await writeFile(new URL(`${name}.json`, OUT_DIR), JSON.stringify(data));
}
await writeFile(new URL("meta.json", OUT_DIR), JSON.stringify({ fetchedAt: new Date().toISOString() }));
console.log("Done → data/raw/");
