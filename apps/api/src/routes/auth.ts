import { auth } from "@burst/auth";
import type { Elysia } from "elysia";

const ACCEPTED_METHODS = new Set(["GET", "POST"]);

/**
 * Mount Better Auth under /api/auth/*.
 * Uses an explicit route (not Elysia.mount) so CORS lifecycle hooks apply.
 */
export function registerAuth(app: Elysia) {
	return app.all("/api/auth/*", ({ request }) => {
		if (!ACCEPTED_METHODS.has(request.method)) {
			return new Response("Method Not Allowed", { status: 405 });
		}
		return auth.handler(request);
	});
}
