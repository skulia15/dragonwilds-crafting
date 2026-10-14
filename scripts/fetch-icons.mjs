// Downloads every icon referenced by src/data/db.json from the wiki once, resized to 96px WebP,
// into public/icons/. Self-hosting = faster pages and no bandwidth cost for the wiki.
// Idempotent: existing files are skipped, so weekly syncs only fetch new icons.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const DB = new URL("../src/data/db.json", import.meta.url);
const OUT = new URL("../public/icons/", import.meta.url);
const WIKI_IMAGES = "https://dragonwilds.runescape.wiki/images/";
const USER_AGENT = "dragonwilds-crafting/0.1 (static crafting lookup; github.com/skulia15/dragonwilds-crafting)";
const SIZE = 96; // 72px max display × ~1.3; crisp enough on 2× screens for these soft renders
const CONCURRENCY = 6;

// Must match localIcon() in src/lib/wiki.ts.
const localName = (file) => `${file.replace(/\.[a-z]+$/i, "").replace(/[^A-Za-z0-9]+/g, "_")}.webp`;

const db = JSON.parse(await readFile(DB, "utf8"));
const files = new Set();
for (const item of db.items) {
	if (item.icon) files.add(item.icon);
	for (const r of item.recipes) for (const m of r.materials) if (m.icon) files.add(m.icon);
}

await mkdir(OUT, { recursive: true });
const todo = [...files].filter((f) => !existsSync(new URL(localName(f), OUT)));
console.log(`${files.size} icons referenced, ${todo.length} to download`);

const failed = [];
let done = 0;
async function worker() {
	for (let file = todo.shift(); file; file = todo.shift()) {
		try {
			const res = await fetch(WIKI_IMAGES + encodeURIComponent(file.replace(/ /g, "_")), {
				headers: { "User-Agent": USER_AGENT },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const webp = await sharp(Buffer.from(await res.arrayBuffer()))
				.resize(SIZE, SIZE, { fit: "inside", withoutEnlargement: true })
				.webp({ quality: 82 })
				.toBuffer();
			await writeFile(new URL(localName(file), OUT), webp);
		} catch (e) {
			failed.push(`${file}: ${e.message}`);
		}
		if (++done % 50 === 0) process.stdout.write(`\r  ${done} downloaded`);
	}
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
process.stdout.write("\n");
if (failed.length) {
	console.log(`${failed.length} icons failed (shown as placeholders):`);
	for (const f of failed) console.log(`  - ${f}`);
}
