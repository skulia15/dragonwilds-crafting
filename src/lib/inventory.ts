// "I already have" counts in localStorage — shared by item pages and the planner, like recipe prefs.
import type { Have } from "./tree";

export const INVENTORY_KEY = "dw:inventory";

export function loadHave(): Have {
	try {
		const raw = JSON.parse(localStorage.getItem(INVENTORY_KEY) ?? "{}") as Have;
		return Object.fromEntries(Object.entries(raw).filter(([, n]) => Number.isFinite(n) && n > 0));
	} catch {
		return {};
	}
}

export function saveHave(have: Have) {
	try {
		if (Object.keys(have).length) localStorage.setItem(INVENTORY_KEY, JSON.stringify(have));
		else localStorage.removeItem(INVENTORY_KEY);
	} catch {}
}

function setHave(slug: string, n: number) {
	const have = loadHave();
	const v = Math.min(99999, Math.max(0, Math.floor(n) || 0));
	if (v) have[slug] = v;
	else delete have[slug];
	saveHave(have);
}

/**
 * Wires "have" inputs and "gathered" checkboxes inside `root` (re-rendered HTML, so delegated).
 * Calls `rerender` after a change and puts focus back on the same input, which the re-render replaced.
 */
export function bindInventory(root: HTMLElement, rerender: () => void) {
	root.addEventListener("change", (e) => {
		const el = e.target as HTMLInputElement;
		let selector: string;
		if (el.dataset.have) {
			setHave(el.dataset.have, Number(el.value));
			selector = `[data-have="${el.dataset.have}"]`;
		} else if (el.dataset.gather) {
			// Ticking = "I have all I need"; unticking clears it.
			setHave(el.dataset.gather, el.checked ? Number(el.dataset.need) : 0);
			selector = `[data-gather="${el.dataset.gather}"]`;
		} else return;
		const hadFocus = document.activeElement === el;
		rerender();
		if (hadFocus) root.querySelector<HTMLInputElement>(selector)?.focus();
	});
}

export async function copyText(text: string, button: HTMLElement) {
	const label = button.textContent;
	try {
		await navigator.clipboard.writeText(text);
		button.textContent = "Copied ✓";
	} catch {
		button.textContent = "Copy failed";
	}
	setTimeout(() => (button.textContent = label), 1500);
}
