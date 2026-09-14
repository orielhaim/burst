import { defineConfig } from "drizzle-kit";
import { dbEnv } from "./src/env";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/auth.ts",
	out: "./drizzle",
	dbCredentials: {
		url: dbEnv.DATABASE_URL,
	},
});
