// Planner list in localStorage; shared by item pages ("Add to planner") and the planner page.
export interface PlanEntry {
	slug: string;
	qty: number;
}

export const PLANNER_KEY = "dw:planner";

export function loadPlanner(): PlanEntry[] {
	try {
		const list = JSON.parse(localStorage.getItem(PLANNER_KEY) ?? "[]") as PlanEntry[];
		return list.filter((e) => typeof e.slug === "string" && e.qty > 0);
	} catch {
		return [];
	}
}

export function savePlanner(list: PlanEntry[]) {
	try {
		if (list.length) localStorage.setItem(PLANNER_KEY, JSON.stringify(list));
		else localStorage.removeItem(PLANNER_KEY);
	} catch {}
}

/** Adds to an existing entry's quantity rather than duplicating it. */
export function addToPlanner(slug: string, qty: number) {
	const list = loadPlanner();
	const existing = list.find((e) => e.slug === slug);
	if (existing) existing.qty += qty;
	else list.push({ slug, qty });
	savePlanner(list);
}

export const clampQty = (v: unknown) => Math.min(9999, Math.max(1, Math.floor(Number(v)) || 1));
