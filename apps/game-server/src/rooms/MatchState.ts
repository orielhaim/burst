import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
	{
		userId: t.string(),
		joinedAt: t.number(),
	},
	"PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const MatchState = schema(
	{
		players: t.map(PlayerState),
		createdAt: t.number(),
	},
	"MatchState",
);
export type MatchState = SchemaType<typeof MatchState>;
