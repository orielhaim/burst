import type { Elysia } from "elysia";

export function registerHealth(app: Elysia) {
	return app.get("/health", () => ({
		status: "ok",
		service: "api",
		timestamp: new Date().toISOString(),
	}));
}
