/** Colyseus room names shared by client and server. */
export const ROOM_MATCH = "match" as const;

/** Default ports (overridable via env on each side). */
export const DEFAULT_WEB_PORT = 3000 as const;
export const DEFAULT_API_PORT = 3001 as const;
export const DEFAULT_GAME_SERVER_PORT = 2567 as const;

/** API path the web client uses to obtain a short-lived game ticket. */
export const GAME_TICKET_PATH = "/game/ticket" as const;
