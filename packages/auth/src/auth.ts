import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@burst/db/client";
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "@burst/db/schema";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { authEnv } from "./env";

/** Tables + relations the Drizzle adapter needs (including joins). */
const authSchema = {
	user,
	session,
	account,
	verification,
	userRelations,
	sessionRelations,
	accountRelations,
};

export const authOptions = {
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	}),
	baseURL: authEnv.BETTER_AUTH_URL,
	secret: authEnv.BETTER_AUTH_SECRET,
	trustedOrigins: authEnv.TRUSTED_ORIGINS,
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		database: {
			joins: true,
		},
	},
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
