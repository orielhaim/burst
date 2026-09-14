import { join } from "node:path";

const root = join(import.meta.dir, "..");

type Proc = ReturnType<typeof Bun.spawn>;

function spawnWorkspace(script: string, filter: string): Proc {
	return Bun.spawn(["bun", "run", "--filter", filter, script], {
		cwd: root,
		stdout: "inherit",
		stderr: "inherit",
		env: process.env,
	});
}

const procs: Proc[] = [
	spawnWorkspace("dev", "web"),
	spawnWorkspace("dev", "@burst/api"),
	spawnWorkspace("dev", "@burst/game-server"),
];

console.log("[dev] starting web (:3000), api (:3001), game-server (:2567)...");

let exiting = false;

function shutdown(code = 0) {
	if (exiting) return;
	exiting = true;
	for (const proc of procs) {
		if (proc.exitCode === null && proc.signalCode === null) {
			proc.kill();
		}
	}
	process.exit(code);
}

for (const proc of procs) {
	proc.exited.then((code) => {
		if (!exiting) {
			console.error(`[dev] process exited with code ${code}, shutting down siblings`);
			shutdown(code ?? 1);
		}
	});
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
