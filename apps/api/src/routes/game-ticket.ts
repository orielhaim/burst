import { auth } from "@burst/auth";
import { signGameTicket } from "@burst/game-auth";
import { GAME_TICKET_PATH } from "@burst/protocol";
import type { Elysia } from "elysia";
import { env } from "../env";

export function registerGameTicket(app: Elysia) {
	return app.post(
		GAME_TICKET_PATH,
		async ({ headers, status }) => {
			const session = await auth.api.getSession({
				headers: new Headers(
					Object.entries(headers).filter(
						(entry): entry is [string, string] => entry[1] != null,
					),
				),
			});
			if (!session) {
				return status(401, { message: "Unauthorized" });
			}

			const { token, claims } = await signGameTicket(
				{ userId: session.user.id, ttlSeconds: env.GAME_TICKET_TTL_SECONDS },
				env.GAME_TICKET_SECRET,
			);

			return {
				token,
				expiresAt: claims.exp,
				userId: claims.sub,
			};
		},
		{
			detail: {
				summary: "Issue a short-lived signed game ticket",
				description:
					"Validates the Better Auth session and returns a JWT the Colyseus client passes via client.auth.token.",
			},
		},
	);
}
