import { z } from "zod";

export const GAME_TICKET_PURPOSE = "game" as const;

export const gameTicketClaimsSchema = z.object({
	/** Better Auth user id */
	sub: z.string().min(1),
	/** Must equal GAME_TICKET_PURPOSE; validated separately so wrong purpose is distinguishable */
	purpose: z.string().min(1),
	/** issued at (unix seconds) */
	iat: z.number().int().nonnegative(),
	/** expiry (unix seconds) */
	exp: z.number().int().positive(),
	/** unique ticket id */
	jti: z.string().min(1),
});

export type GameTicketClaims = z.infer<typeof gameTicketClaimsSchema>;

export type SignGameTicketInput = {
	userId: string;
	/** seconds from now; caller decides TTL */
	ttlSeconds: number;
};
