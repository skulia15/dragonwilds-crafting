// Appends a "what's new" entry to src/data/changelog.json by diffing the freshly built db.json against
// the committed one. Run after wiki:build and before committing (the weekly Action does this).
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const DB = "src/data/db.json";
const LOG = new URL("../src/data/changelog.json", import.meta.url);
const MAX_ENTRIES = 52; // ~a year of weekly syncs

let before;
try {
	before = JSON.parse(execFileSync("git", ["show", `HEAD:${DB}`], { encoding: "utf8", maxBuffer: 64 << 20 }));
} catch {
	console.log("No committed db.json to diff against; skipping.");
	process.exit(0);
}
const after = JSON.parse(await readFile(DB, "utf8"));

const index = (db) => new Map(db.items.map((i) => [i.slug, i]));
const [old, now] = [index(before), index(after)];
const ref = (i) => ({ slug: i.slug, name: i.name });
const recipeIds = (i) => i.recipes.map((r) => r.id).sort().join();

const added = [...now.values()].filter((i) => !old.has(i.slug)).map(ref);
const removed = [...old.values()].filter((i) => !now.has(i.slug)).map((i) => i.name);
const changed = [...now.values()]
	.filter((i) => old.has(i.slug) && recipeIds(old.get(i.slug)) !== recipeIds(i))
	.map(ref);

if (!added.length && !removed.length && !changed.length) {
	console.log("No item/recipe changes; changelog untouched.");
	process.exit(0);
}

const log = JSON.parse(await readFile(LOG, "utf8").catch(() => "[]"));
log.unshift({ date: after.fetchedAt.slice(0, 10), added, removed, changed });
await writeFile(LOG, `${JSON.stringify(log.slice(0, MAX_ENTRIES), null, "\t")}\n`);
console.log(`Changelog: +${added.length} new, ${changed.length} changed recipes, -${removed.length} removed.`);
