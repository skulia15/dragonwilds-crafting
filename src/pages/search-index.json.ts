import type { APIRoute } from "astro";
import { getCategory, items } from "../lib/db";

// Compact tuple rows keep the payload small: [name, slug, icon, category, craftable].
export type SearchRow = [string, string, string | null, string, 0 | 1];

export const GET: APIRoute = () => {
	const rows: SearchRow[] = items.map((i) => [
		i.name,
		i.slug,
		i.icon,
		getCategory(i.category)?.name ?? "",
		i.recipes.length ? 1 : 0,
	]);
	return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
};
