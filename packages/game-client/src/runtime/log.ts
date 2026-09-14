const entries: string[] = [];
const MAX = 150;

function stringify(value: unknown): string {
	try {
		if (value instanceof Error) return `${value.name}: ${value.message}`;
		if (typeof value === "string") return value;
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

/** Dev lifecycle log with a replayable buffer (surfaces in the crash card). */
export function devLog(...args: unknown[]): void {
	const line = args.map(stringify).join(" ");
	entries.push(line);
	if (entries.length > MAX) entries.splice(0, entries.length - MAX);
	console.debug("[burst]", ...args);
}

export function getLogLines(): string[] {
	return [...entries];
}
