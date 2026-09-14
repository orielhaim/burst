/**
 * Framework-independent scope optics math (no Three.js).
 * Presentation lives in the R3F `ScopeLens` component.
 */

export function magnifiedFovDegrees(
	sourceAngularFovDegrees: number,
	magnification: number,
): number {
	const sourceRadians = (sourceAngularFovDegrees * Math.PI) / 180;
	return (
		(2 * Math.atan(Math.tan(sourceRadians / 2) / magnification) * 180) / Math.PI
	);
}

export function lensAngularFovDegrees(radius: number, eyeRelief: number): number {
	if (radius <= 0 || eyeRelief <= 0) return 1;
	return ((2 * Math.atan(radius / eyeRelief)) * 180) / Math.PI;
}

/** Clamp a render-target size the same way the old renderer did. */
export function scopeTargetSize(
	drawingBufferMin: number,
	resolutionScale: number,
	min = 128,
	max = 1024,
): number {
	return Math.round(
		Math.max(min, Math.min(max, drawingBufferMin * resolutionScale)),
	);
}
