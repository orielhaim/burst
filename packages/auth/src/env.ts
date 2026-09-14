import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envSchema = z.object({
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

export type AuthEnv = z.infer<typeof envSchema>;

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

export const authEnv: AuthEnv = envSchema.parse(process.env);
