import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. Talks to the Elysia API (`apps/api`), not this app's server.
 * Cookies are shared cross-origin — the API must allow credentials for WEB_ORIGIN.
 */
export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
	fetchOptions: {
		credentials: "include",
	},
});

export const { signIn, signUp, signOut, useSession } = authClient;
