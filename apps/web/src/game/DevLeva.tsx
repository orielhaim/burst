import { Leva } from "leva";

/** Leva panel UI (DOM). Lazy-loaded so production bundles never include Leva. */
export function DevLeva() {
	return <Leva collapsed titleBar={{ title: "burst tuning" }} />;
}
