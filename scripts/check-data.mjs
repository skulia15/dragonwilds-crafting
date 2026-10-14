// Guards the weekly sync: fails if the freshly built db.json lost a big chunk of data compared to
// the committed one (wiki outage, Bucket schema change), so a bad sync never gets committed/deployed.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const MAX_DROP = 0.1;
const PATH = "src/data/db.json";

const counts = (db) => ({
	items: db.items.length,
	craftable: db.items.filter((i) => i.recipes.length).length,
	recipes: db.items.reduce((n, i) => n + i.recipes.length, 0),
});

let committed;
try {
	committed = JSON.parse(execFileSync("git", ["show", `HEAD:${PATH}`], { encoding: "utf8", maxBuffer: 64 << 20 }));
} catch {
	console.log("No committed db.json to compare against; skipping.");
	process.exit(0);
}
const before = counts(committed);
const after = counts(JSON.parse(await readFile(PATH, "utf8")));

let failed = false;
for (const key of Object.keys(before)) {
	const drop = before[key] ? (before[key] - after[key]) / before[key] : 0;
	const line = `${key}: ${before[key]} → ${after[key]}`;
	if (drop > MAX_DROP) {
		console.error(`✗ ${line} (dropped ${(drop * 100).toFixed(1)}%)`);
		failed = true;
	} else console.log(`✓ ${line}`);
}
if (failed) {
	console.error(`Data dropped more than ${MAX_DROP * 100}% — refusing to publish. Investigate the wiki/Bucket schema.`);
	process.exit(1);
}
