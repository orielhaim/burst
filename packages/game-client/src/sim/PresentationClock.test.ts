import { expect, test } from "bun:test";
import { PresentationClock, FIXED_DT } from "./PresentationClock";

for (const hz of [15, 30, 60, 75, 120, 144, 165, 240]) {
	test(`camera and physics presentation share the same time at ${hz} Hz`, () => {
		const clock = new PresentationClock();
		let physicsRemainder = 0;
		let simulationTime = 0;
		let elapsed = 0;
		for (let frame = 0; frame < hz * 5; frame++) {
			// Include uneven delivery and a long suspended-tab frame.
			const delta = frame === 13 ? 2 : (1 + Math.sin(frame) * 0.25) / hz;
			const accepted = clock.beginFrame(delta);
			elapsed += accepted;
			physicsRemainder += Math.min(delta, 0.5);
			while (physicsRemainder >= FIXED_DT) {
				clock.physicsStep();
				simulationTime += FIXED_DT;
				physicsRemainder -= FIXED_DT;
			}
			expect(clock.alpha).toBeCloseTo(physicsRemainder / FIXED_DT, 10);
			if (simulationTime > 0)
				expect(simulationTime - FIXED_DT + clock.alpha * FIXED_DT).toBeCloseTo(elapsed - FIXED_DT, 8);
		}
	});
}
