export type ReticleDefinition = {
	readonly type: "cross";
	readonly color: number;
	readonly lineWidth: number;
	readonly gap: number;
};

export interface ScopeDefinition {
	readonly id: string;
	readonly name: string;
	readonly magnification: number;
	readonly reticle: ReticleDefinition;
	readonly lens: {
		readonly radius: number;
		readonly renderResolutionScale: number;
	};
	readonly housing: {
		readonly radius: number;
		readonly length: number;
	};
}
