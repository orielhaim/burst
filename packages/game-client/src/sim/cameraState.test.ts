import { expect, test } from "bun:test";
import { CameraState } from "./cameraState";
import {
	primaryLoadout,
	sniperDefinition,
	smgDefinition,
} from "../weapons/definitions/loadout";

test("every firearm delivers its configured angular recoil immediately and recovers", () => {
	for (const weapon of primaryLoadout)
		for (const profile of [weapon.recoil.hip, weapon.recoil.ads]) {
			const camera = new CameraState();
			camera.addRecoil(profile.cameraPitch, profile.cameraYaw);
			expect(camera.getRecoil().pitch).toBeCloseTo(profile.cameraPitch, 8);
			expect(camera.forward().y).toBeGreaterThan(0);
			for (let i = 0; i < 180; i++) camera.updateRecoil(1 / 120);
			expect(Math.abs(camera.getRecoil().pitch)).toBeLessThan(
				profile.cameraPitch * 0.01,
			);
		}
	expect(sniperDefinition.recoil.ads.cameraPitch).toBeGreaterThan(
		smgDefinition.recoil.ads.cameraPitch * 5,
	);
});
