import { cors } from "@elysiajs/cors";
import { GAME_TICKET_PATH } from "@burst/protocol";
import { Elysia } from "elysia";
import { env } from "./env";
import { registerAuth } from "./routes/auth";
import { registerGameTicket } from "./routes/game-ticket";
import { registerHealth } from "./routes/health";

const app = new Elysia({ name: "burst-api" })
	.use(
		cors({
			origin: env.CORS_ORIGINS,
			credentials: true,
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.use(registerHealth)
	.use(registerAuth)
	.use(registerGameTicket);

app.listen(env.API_PORT);

console.log(
	`[api] listening on http://${app.server?.hostname ?? "localhost"}:${env.API_PORT}`,
);
console.log(`[api] auth routes at /api/auth/*`);
console.log(`[api] game ticket at ${GAME_TICKET_PATH}`);

export type App = typeof app;
