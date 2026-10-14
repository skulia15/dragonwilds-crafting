// Pings IndexNow (Bing, Yandex, Seznam…; Bing shares with others) with every URL in the live sitemap so new or
// changed pages get crawled without waiting. The key file lives in public/ — key is public by design.
const KEY = "702d5795568a3468d5136462c229fd33";
const SITE = process.env.SITE_URL; // e.g. https://skulia15.github.io/dragonwilds-crafting/
if (!SITE) throw new Error("SITE_URL not set");
const base = SITE.endsWith("/") ? SITE : `${SITE}/`;

const locs = async (url) => [...(await (await fetch(url)).text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const urlList = (await Promise.all((await locs(`${base}sitemap-index.xml`)).map(locs))).flat();

const res = await fetch("https://api.indexnow.org/indexnow", {
	method: "POST",
	headers: { "Content-Type": "application/json; charset=utf-8" },
	body: JSON.stringify({ host: new URL(base).host, key: KEY, keyLocation: `${base}${KEY}.txt`, urlList: urlList.slice(0, 10000) }),
});
console.log(`IndexNow: submitted ${urlList.length} URLs → HTTP ${res.status}`);
// 200/202 = accepted; 403/422 usually means the key file isn't live yet. Don't fail the deploy over it.
