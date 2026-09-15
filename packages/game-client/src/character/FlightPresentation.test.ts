import { expect, test } from "bun:test";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { createParachuteModel } from "./ParachuteModel";

for (const hz of [30, 60, 144, 240]) {
	test(`flight grips stay fixed in view through descent and mouse-look at ${hz} Hz`, () => {
		const model = createParachuteModel();
		try {
			const camera = new PerspectiveCamera(75, 16 / 9, 0.05, 200);
			camera.rotation.order = "YXZ";
			camera.add(model.controls);
			const expected = model.hands.map((hand) => hand.position.clone());
			for (let i = 0; i < hz * 2; i++) {
				const t = i / hz;
				camera.position.set(9 * t, 58 - 18 * t, -7 * t);
				camera.rotation.set(-1.4 + t * 1.3, 3 + t * 4, 0);
				// The character pose arrives at 60 Hz; view grips never read it.
				const tick = Math.floor(t * 60) / 60;
				model.update(
					{ x: tick * 9, y: 57 - tick * 18, z: -7 * tick },
					tick,
					true,
				);
				camera.updateMatrixWorld(true);
				for (const [index, hand] of model.hands.entries()) {
					const view = camera.worldToLocal(
						hand.getWorldPosition(new Vector3()),
					);
					expect(view.distanceTo(expected[index]!)).toBeLessThan(1e-10);
					const screen = hand.getWorldPosition(new Vector3()).project(camera);
					expect(Math.abs(screen.x)).toBeLessThan(0.8);
					expect(screen.y).toBeLessThan(0);
				}
			}
		} finally {
			model.dispose();
		}
	});
}

test("flight controls contain only hands, short forearms and toggles, clear of the near plane", () => {
	const model = createParachuteModel();
	try {
		const bounds = new Box3().setFromObject(model.controls);
		expect(bounds.max.z).toBeLessThan(-0.25);
		expect(model.hands).toHaveLength(2);
		model.controls.traverse((node) => expect(node.layers.mask).toBe(1 << 1));
	} finally {
		model.dispose();
	}
});

test("canopy follows the character attachment and retracts on landing", () => {
	const model = createParachuteModel();
	try {
		expect(model.canopy.visible).toBe(false);
		expect(model.controls.visible).toBe(false);
		model.update({ x: 3, y: 19, z: -8 }, 0.7, true);
		expect(model.canopy.position.toArray()).toEqual([3, 19, -8]);
		expect(model.canopy.rotation.y).toBe(0.7);
		expect(model.canopy.visible).toBe(true);
		expect(
			model.canopy.children.filter((part) =>
				part.name.startsWith("canopy-cell"),
			),
		).toHaveLength(8);
		const bounds = new Box3().setFromObject(model.canopy);
		expect(bounds.max.y).toBeGreaterThan(22);
		model.update({ x: 4, y: 1.2, z: -8 }, 0.7, false);
		expect(model.canopy.visible).toBe(false);
		expect(model.controls.visible).toBe(false);
	} finally {
		model.dispose();
	}
});
