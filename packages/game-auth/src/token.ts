import { errors, SignJWT, jwtVerify } from "jose";
import {
	GAME_TICKET_PURPOSE,
	gameTicketClaimsSchema,
	type GameTicketClaims,
	type SignGameTicketInput,
} from "./claims";

export class GameTicketError extends Error {
	readonly code:
		| "missing_token"
		| "invalid_signature"
		| "expired"
		| "wrong_purpose"
		| "malformed_claims";

	constructor(
		code: GameTicketError["code"],
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = "GameTicketError";
		this.code = code;
	}
}

function secretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

function joseErrorCode(error: unknown): string | undefined {
	if (error && typeof error === "object" && "code" in error) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === "string") return code;
	}
	return undefined;
}

function classifyJoseError(error: unknown): GameTicketError {
	const code = joseErrorCode(error);
	const message = error instanceof Error ? error.message : "";
	if (code === errors.JWTExpired.code || /expired/i.test(message)) {
		return new GameTicketError("expired", "Game ticket has expired", { cause: error });
	}
	if (
		code === errors.JWSSignatureVerificationFailed.code ||
		code === errors.JWTInvalid.code ||
		code === errors.JWSInvalid.code
	) {
		return new GameTicketError("invalid_signature", "Game ticket signature is invalid", {
			cause: error,
		});
	}
	return new GameTicketError("malformed_claims", "Game ticket could not be verified", {
		cause: error,
	});
}

export async function signGameTicket(
	input: SignGameTicketInput,
	secret: string,
): Promise<{ token: string; claims: GameTicketClaims }> {
	if (!secret) {
		throw new GameTicketError("invalid_signature", "GAME_TICKET_SECRET is not configured");
	}
	if (input.ttlSeconds <= 0) {
		throw new GameTicketError("malformed_claims", "ttlSeconds must be positive");
	}

	const jti = crypto.randomUUID();
	const token = await new SignJWT({ purpose: GAME_TICKET_PURPOSE })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(input.userId)
		.setIssuedAt()
		.setExpirationTime(`${input.ttlSeconds}s`)
		.setJti(jti)
		.sign(secretKey(secret));

	// Round-trip once so callers always receive validated claims.
	const claims = await verifyGameTicket(token, secret);
	return { token, claims };
}

export async function verifyGameTicket(
	token: string | undefined | null,
	secret: string,
): Promise<GameTicketClaims> {
	if (!token) {
		throw new GameTicketError("missing_token", "Game ticket is required");
	}
	if (!secret) {
		throw new GameTicketError("invalid_signature", "GAME_TICKET_SECRET is not configured");
	}

	let payload: unknown;
	try {
		const verified = await jwtVerify(token, secretKey(secret), {
			algorithms: ["HS256"],
		});
		payload = verified.payload;
	} catch (error) {
		throw classifyJoseError(error);
	}

	const parsed = gameTicketClaimsSchema.safeParse(payload);
	if (!parsed.success) {
		throw new GameTicketError("malformed_claims", "Game ticket claims are malformed");
	}

	if (parsed.data.purpose !== GAME_TICKET_PURPOSE) {
		throw new GameTicketError("wrong_purpose", "Game ticket has the wrong purpose");
	}

	return parsed.data;
}
