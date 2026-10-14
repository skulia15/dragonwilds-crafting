import db from "../data/db.json";
import type { Graph } from "./tree";

export interface Material {
	label: string;
	qty: number;
	icon: string | null;
	slug: string;
}

export interface Recipe {
	id: string;
	station: { name: string; slug: string | null } | null;
	outputLabel: string;
	outputQty: number;
	skills: { name: string; xp: number }[];
	materials: Material[];
	/** Plan/pattern/vestige needed to learn the recipe; slug is null when it has no page here. */
	requires: { label: string; slug: string | null } | null;
}

export interface Item {
	slug: string;
	name: string;
	wiki: string;
	icon: string | null;
	type: string | null;
	category: string;
	description: string;
	extract: string;
	recipes: Recipe[];
	usedIn: string[];
	drops: { source: string; qty: string; rarity: string }[];
	shops: { seller: string; cost: number | null; currency: string | null }[];
	unlockedBy: { perk: string; skill: string; level: number | null; description: string }[];
}

export interface Category {
	slug: string;
	name: string;
	count: number;
	craftable: number;
}

export const items = db.items as Item[];
export const categories = db.categories as Category[];
export const fetchedAt = db.fetchedAt;

const bySlug = new Map(items.map((i) => [i.slug, i]));
const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

export function getItem(slug: string): Item {
	const item = bySlug.get(slug);
	if (!item) throw new Error(`Unknown item slug: ${slug}`);
	return item;
}

export const getCategory = (slug: string) => categoryBySlug.get(slug);

// Station slug → items crafted there. Build Menu recipes have no station slug.
const craftedAt = new Map<string, Item[]>();
for (const item of items) {
	const stations = new Set(item.recipes.map((r) => r.station?.slug).filter((s): s is string => !!s));
	for (const s of stations) craftedAt.set(s, [...(craftedAt.get(s) ?? []), item]);
}
export const getCraftedAt = (stationSlug: string) => craftedAt.get(stationSlug) ?? [];

// Plan/pattern slug → items whose recipe it teaches.
const taughtBy = new Map<string, Item[]>();
for (const item of items) {
	const plans = new Set(item.recipes.map((r) => r.requires?.slug).filter((s): s is string => !!s));
	for (const s of plans) taughtBy.set(s, [...(taughtBy.get(s) ?? []), item]);
}
export const getRecipesTaughtBy = (slug: string) => taughtBy.get(slug) ?? [];

const itemNames = new Set(items.map((i) => i.name));
/**
 * The one source worth showing in a tree leaf: a guaranteed world source (resource node, plant,
 * creature) beats a pack/container (those are items themselves) or a rare chest drop.
 */
function bestSource(item: Item): string | null {
	const rank = (d: Item["drops"][number]) => (itemNames.has(d.source) ? 2 : 0) + (d.rarity === "Always" ? 0 : 1);
	const best = item.drops.toSorted((a, b) => rank(a) - rank(b))[0];
	return best?.source ?? item.shops[0]?.seller ?? null;
}

/** Items reachable from `slug` via any recipe — what a page embeds so the tree can re-render client-side. */
export function subgraph(slug: string): Graph {
	const graph: Graph = {};
	const visit = (s: string) => {
		if (graph[s]) return;
		const item = getItem(s);
		graph[s] = {
			name: item.name,
			icon: item.icon,
			source: bestSource(item),
			recipes: item.recipes.map((r) => ({
				id: r.id,
				station: r.station?.name ?? null,
				outputQty: r.outputQty,
				materials: r.materials,
			})),
		};
		for (const r of item.recipes) for (const m of r.materials) visit(m.slug);
	};
	visit(slug);
	return graph;
}
