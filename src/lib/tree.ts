// Crafting tree + totals, shared by the static render and the in-browser re-render
// (when a player picks an alternate recipe). Must not import db.json — it ships to the client.
import { href, iconUrl } from "./wiki";

export interface TreeRecipe {
	id: string;
	station: string | null;
	outputQty: number;
	materials: { slug: string; label: string; qty: number; icon: string | null }[];
}

export interface TreeItem {
	name: string;
	icon: string | null;
	/** First known drop/shop source, shown on leaves. */
	source: string | null;
	recipes: TreeRecipe[];
}

/** Every item reachable from a page's root through any recipe, keyed by slug. */
export type Graph = Record<string, TreeItem>;
/** Item slug → chosen recipe id. Missing/unknown ids fall back to the item's first recipe. */
export type Prefs = Record<string, string>;

const MAX_DEPTH = 8;

export const recipeFor = (graph: Graph, slug: string, prefs: Prefs): TreeRecipe | undefined => {
	const { recipes } = graph[slug];
	return recipes.find((r) => r.id === prefs[slug]) ?? recipes[0];
};

const isCustom = (graph: Graph, slug: string, prefs: Prefs) =>
	graph[slug].recipes.length > 1 && recipeFor(graph, slug, prefs) !== graph[slug].recipes[0];

const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const recipeLabel = (r: TreeRecipe) =>
	`${r.station ?? "Unknown station"}: ${r.materials.map((m) => `${m.qty} ${m.label}`).join(", ") || "no materials"}${
		r.outputQty > 1 ? ` (makes ${r.outputQty})` : ""
	}`;

function picker(graph: Graph, slug: string, prefs: Prefs): string {
	const { recipes } = graph[slug];
	if (recipes.length < 2) return "";
	const chosen = recipeFor(graph, slug, prefs);
	const options = recipes
		.map(
			(r, i) =>
				`<option value="${r.id}"${r === chosen ? " selected" : ""}>${esc(recipeLabel(r))}${i === 0 ? " — default" : ""}</option>`,
		)
		.join("");
	return `<label class="pick"><span>Recipe</span><select data-slug="${slug}" aria-label="Recipe for ${esc(graph[slug].name)}">${options}</select></label>`;
}

function icon(file: string | null, size: number) {
	const src = iconUrl(file);
	return src
		? `<img class="icon" src="${esc(src)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
		: `<span class="icon placeholder" style="width:${size}px;height:${size}px"></span>`;
}

function nodes(graph: Graph, recipe: TreeRecipe, crafts: number, path: string[], prefs: Prefs): string {
	const items = recipe.materials.map((m) => {
		const mat = graph[m.slug];
		const need = m.qty * crafts;
		const sub = mat.recipes.length ? recipeFor(graph, m.slug, prefs) : undefined;
		const expandable = sub && !path.includes(m.slug) && path.length < MAX_DEPTH;
		const hint = sub
			? `at ${esc(sub.station ?? "?")}${isCustom(graph, m.slug, prefs) ? ' <span class="custom">your recipe</span>' : ""}`
			: mat.source
				? `from ${esc(mat.source)}`
				: "";
		const row = `<span class="row">${icon(m.icon ?? mat.icon, 26)}<span class="qty">${need}×</span><a href="${href(
			`/item/${m.slug}/`,
		)}">${esc(m.label)}</a>${hint && `<span class="hint">${hint}</span>`}</span>`;
		if (!expandable) return `<li><div class="leaf">${row}</div></li>`;
		const nextPath = [...path, m.slug];
		return `<li><details data-path="${nextPath.join("/")}"${path.length < 2 ? " open" : ""}><summary>${row}</summary>${picker(
			graph,
			m.slug,
			prefs,
		)}${nodes(graph, sub, Math.ceil(need / sub.outputQty), nextPath, prefs)}</details></li>`;
	});
	return `<ul class="tree">${items.join("")}</ul>`;
}

/** Tree HTML for `qty` of `root`. Quantities are per branch, as you'd read them top-down. */
export function renderTree(graph: Graph, root: string, prefs: Prefs, qty = 1): string {
	const recipe = recipeFor(graph, root, prefs);
	if (!recipe) return "";
	return picker(graph, root, prefs) + nodes(graph, recipe, Math.ceil(qty / recipe.outputQty), [root], prefs);
}

export interface PlanStep {
	slug: string;
	crafts: number;
	station: string | null;
}

/**
 * Raw materials + craft steps for several targets at once (planner) or one target × qty (item page).
 * Demand for shared intermediates is summed across everything before rounding crafts up, so two
 * branches needing 1 bar each cost one 2-bar craft, not two.
 */
export function plan(
	graph: Graph,
	targets: { slug: string; qty: number }[],
	prefs: Prefs,
): { raw: { slug: string; qty: number }[]; steps: PlanStep[] } {
	// DFS for a topological order of the expansion graph; an edge back to an ancestor (recipe cycle,
	// e.g. bar ⇄ salvage) is cut and that material is counted as raw instead.
	const order: string[] = [];
	const backEdges = new Set<string>();
	const truncated = new Set<string>();
	const state = new Map<string, "visiting" | "done">();
	const visit = (slug: string, depth: number) => {
		state.set(slug, "visiting");
		const recipe = recipeFor(graph, slug, prefs);
		if (recipe && depth >= MAX_DEPTH) truncated.add(slug);
		else if (recipe) {
			for (const m of recipe.materials) {
				const s = state.get(m.slug);
				if (s === "visiting") backEdges.add(`${slug}>${m.slug}`);
				else if (!s) visit(m.slug, depth + 1);
			}
		}
		state.set(slug, "done");
		order.push(slug);
	};
	for (const t of targets) if (!state.has(t.slug)) visit(t.slug, 0);
	order.reverse();

	const add = (map: Map<string, number>, slug: string, n: number) => map.set(slug, (map.get(slug) ?? 0) + n);
	const demand = new Map<string, number>();
	for (const t of targets) add(demand, t.slug, t.qty);
	const raw = new Map<string, number>();
	const steps: PlanStep[] = [];
	for (const slug of order) {
		const need = demand.get(slug) ?? 0;
		if (!need) continue;
		const recipe = recipeFor(graph, slug, prefs);
		if (!recipe || truncated.has(slug)) {
			add(raw, slug, need);
			continue;
		}
		const crafts = Math.ceil(need / recipe.outputQty);
		steps.push({ slug, crafts, station: recipe.station });
		for (const m of recipe.materials) {
			add(backEdges.has(`${slug}>${m.slug}`) ? raw : demand, m.slug, m.qty * crafts);
		}
	}
	return {
		raw: [...raw]
			.map(([slug, n]) => ({ slug, qty: n }))
			.sort((a, b) => b.qty - a.qty || graph[a.slug].name.localeCompare(graph[b.slug].name)),
		// Topological order is root-first; reverse so ingredients are crafted before what uses them.
		steps: steps.reverse(),
	};
}

export const totals = (graph: Graph, root: string, prefs: Prefs, qty = 1) =>
	plan(graph, [{ slug: root, qty }], prefs).raw;

export function renderTotals(graph: Graph, root: string, prefs: Prefs, qty = 1): string {
	return totals(graph, root, prefs, qty)
		.map(
			({ slug, qty }) =>
				`<li>${icon(graph[slug].icon, 26)}<span class="qty">${qty}×</span><a href="${href(`/item/${slug}/`)}">${esc(
					graph[slug].name,
				)}</a></li>`,
		)
		.join("");
}

/** True if any item that actually appears in the current tree uses a non-default recipe. */
export function usesCustomRecipes(graph: Graph, root: string, prefs: Prefs): boolean {
	const seen = new Set<string>();
	const walk = (slug: string, depth: number): boolean => {
		if (seen.has(slug) || depth > MAX_DEPTH) return false;
		seen.add(slug);
		const recipe = recipeFor(graph, slug, prefs);
		if (!recipe) return false;
		return isCustom(graph, slug, prefs) || recipe.materials.some((m) => walk(m.slug, depth + 1));
	};
	return walk(root, 0);
}
