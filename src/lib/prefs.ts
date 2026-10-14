import type { Prefs } from "./tree";

const KEY = "dw:recipe-prefs";

// localStorage can throw (Safari private mode, disabled storage); prefs are a nicety, so fail soft.
export function loadPrefs(): Prefs {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Prefs;
	} catch {
		return {};
	}
}

export function savePrefs(prefs: Prefs) {
	try {
		if (Object.keys(prefs).length) localStorage.setItem(KEY, JSON.stringify(prefs));
		else localStorage.removeItem(KEY);
	} catch {}
}

export const PREFS_KEY = KEY;
