import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envSchema = z.object({
	API_PORT: z.coerce.number().int().positive().default(3001),
	CORS_ORIGINS: z
		.string()
		.default("http://localhost:3000")
		.transform((value) =>
			value
				.split(",")
				.map((entry) => entry.trim())
				.filter(Boolean),
		),
	GAME_TICKET_SECRET: z.string().min(32),
	GAME_TICKET_TTL_SECONDS: z.coerce.number().int().positive().default(300),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	TRUSTED_ORIGINS: z
		.string()
		.default("http://localhost:3000")
		.transform((value) =>
			value
				.split(",")
				.map((entry) => entry.trim())
				.filter(Boolean),
		),
});

export type ApiEnv = z.infer<typeof envSchema>;

function loadRootEnv(): void {
	let dir = dirname(fileURLToPath(import.meta.url));
	for (let i = 0; i < 6; i++) {
		const envPath = resolve(dir, ".env");
		if (existsSync(envPath)) {
			for (const line of readFileSync(envPath, "utf8").split("\n")) {
				const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
				if (!match) continue;
				const key = match[1];
				if (!key) continue;
				let value = match[2] ?? "";
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				if (process.env[key] === undefined && value !== "") {
					process.env[key] = value;
				}
			}
			return;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
}

loadRootEnv();

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	console.error("Invalid API environment configuration:");
	for (const issue of parsed.error.issues) {
		console.error(`  ${issue.path.join(".")}: ${issue.message}`);
	}
	process.exit(1);
}

export const env: ApiEnv = parsed.data;
