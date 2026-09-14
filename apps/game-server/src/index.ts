import { BunWebSockets } from "@colyseus/bun-websockets";
import { ROOM_MATCH } from "@burst/protocol";
import { defineRoom, defineServer } from "colyseus";
import { env } from "./env";
import { MatchRoom } from "./rooms/MatchRoom";

const server = defineServer({
	// Transport isolated here because Bun WebSockets are still experimental in Colyseus.
	transport: new BunWebSockets(),
	rooms: {
		[ROOM_MATCH]: defineRoom(MatchRoom),
	},
});

server.listen(env.GAME_SERVER_PORT);

console.log(`[game] Colyseus (Bun WebSockets) listening on :${env.GAME_SERVER_PORT}`);
console.log(`[game] room "${ROOM_MATCH}" registered`);
