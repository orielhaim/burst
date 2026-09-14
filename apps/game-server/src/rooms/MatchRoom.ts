import {
	GameTicketError,
	verifyGameTicket,
	type GameTicketClaims,
} from "@burst/game-auth";
import { Room, ServerError, type Client } from "colyseus";
import { env } from "../env";
import { MatchState, PlayerState } from "./MatchState";

/**
 * Minimal foundational room:
 * - static onAuth validates the Better Auth-derived game ticket
 * - join/leave lifecycle syncs a simple player map
 * - no gameplay yet
 */
export class MatchRoom extends Room<{ state: MatchState }> {
	override maxClients = 8;

	override onCreate(): void {
		const state = new MatchState();
		state.createdAt = Date.now();
		this.setState(state);
		console.log(`[game] MatchRoom created: ${this.roomId}`);
	}

	/**
	 * Static onAuth runs at matchmake time (before the room instance exists).
	 * Overrides Colyseus' default JWT path — identity comes from @burst/game-auth tickets only.
	 */
	static override async onAuth(
		token: string | undefined,
		_options: unknown,
		_context: unknown,
	): Promise<GameTicketClaims> {
		try {
			return await verifyGameTicket(token, env.GAME_TICKET_SECRET);
		} catch (error) {
			if (error instanceof GameTicketError) {
				throw new ServerError(401, error.code);
			}
			throw new ServerError(401, "unauthorized");
		}
	}

	override onJoin(client: Client, _options: unknown, auth?: GameTicketClaims): void {
		if (!auth?.sub) {
			throw new ServerError(401, "unauthorized");
		}

		const player = new PlayerState();
		player.userId = auth.sub;
		player.joinedAt = Date.now();
		this.state.players.set(client.sessionId, player);

		console.log(
			`[game] user ${auth.sub} joined room ${this.roomId} (session ${client.sessionId})`,
		);
	}

	override onLeave(client: Client): void {
		const player = this.state.players.get(client.sessionId);
		this.state.players.delete(client.sessionId);
		console.log(
			`[game] user ${player?.userId ?? "unknown"} left room ${this.roomId} (session ${client.sessionId})`,
		);
	}

	override onDispose(): void {
		console.log(`[game] MatchRoom disposed: ${this.roomId}`);
	}
}
