// URL helpers kept free of db.json imports so client scripts can use them cheaply.
const WIKI = "https://dragonwilds.runescape.wiki";

/** Prefixes a site-relative path with the configured base (needed for GitHub Pages project sites). */
export const href = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;

/** Self-hosted icon filename; must match localName() in scripts/fetch-icons.mjs. */
export const localIcon = (file: string) => `${file.replace(/\.[a-z]+$/i, "").replace(/[^A-Za-z0-9]+/g, "_")}.webp`;
export const iconUrl = (file: string | null) => file && href(`/icons/${localIcon(file)}`);
export const wikiUrl = (title: string) => `${WIKI}/w/${encodeURIComponent(title.replace(/ /g, "_"))}`;


