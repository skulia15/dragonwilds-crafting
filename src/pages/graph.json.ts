import type { APIRoute } from "astro";
import { fullGraph } from "../lib/db";

export const GET: APIRoute = () =>
	new Response(JSON.stringify(fullGraph()), { headers: { "Content-Type": "application/json" } });
