// URL helpers kept free of db.json imports so client scripts can use them cheaply.
const WIKI = "https://dragonwilds.runescape.wiki";

export const iconUrl = (file: string | null) => file && `${WIKI}/images/${encodeURIComponent(file.replace(/ /g, "_"))}`;
export const wikiUrl = (title: string) => `${WIKI}/w/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Prefixes a site-relative path with the configured base (needed for GitHub Pages project sites). */
export const href = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
