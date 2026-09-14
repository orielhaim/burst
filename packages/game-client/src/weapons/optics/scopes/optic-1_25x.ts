import { ScopeRegistry } from "../ScopeRegistry";

export const optic125x = ScopeRegistry.register({
	id: "optic-1.25x",
	name: "Compact 1.25x",
	magnification: 1.25,
	reticle: {
		type: "cross",
		color: 0x261f1a,
		lineWidth: 0.004,
		gap: 0.012,
	},
	lens: {
		radius: 0.046,
		renderResolutionScale: 0.45,
	},
	housing: {
		radius: 0.058,
		length: 0.15,
	},
});
