// @ts-check
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// SITE / BASE let the same build target a custom domain ("/") or a GitHub Pages
// project site ("/dragonwilds-crafting/") without code changes.
export default defineConfig({
	site: process.env.SITE ?? "http://localhost:4321",
	base: process.env.BASE ?? "/",
	trailingSlash: "always",
	integrations: [sitemap()],
});
