import * as THREE from "three";
import type { Vec3 } from "../core/types";
import { COLORS } from "../rendering/palette";

/** World canopy and camera-space controls share a lifetime, not a transform. */
export function createParachuteModel() {
	const canopy = new THREE.Group();
	canopy.name = "character-parachute";
	const controls = new THREE.Group();
	controls.name = "parachute-first-person-controls";
	canopy.visible = controls.visible = false;
	const geometries: THREE.BufferGeometry[] = [];
	const materials: THREE.Material[] = [];
	const material = (color: number) => {
		const value = new THREE.MeshLambertMaterial({
			color,
			flatShading: true,
			side: THREE.DoubleSide,
		});
		materials.push(value);
		return value;
	};
	const blue = material(COLORS.characterShirt);
	const paper = material(COLORS.characterPaper);
	const ink = material(COLORS.characterInk);
	const gold = material(0xf0bd45);
	const mesh = (
		parent: THREE.Group,
		geometry: THREE.BufferGeometry,
		mat: THREE.Material,
	) => {
		geometries.push(geometry);
		const value = new THREE.Mesh(geometry, mat);
		parent.add(value);
		return value;
	};
	const rod = (
		parent: THREE.Group,
		a: THREE.Vector3,
		b: THREE.Vector3,
		radius: number,
		mat: THREE.Material,
	) => {
		const delta = b.clone().sub(a);
		const value = mesh(
			parent,
			new THREE.CylinderGeometry(radius, radius, delta.length(), 6),
			mat,
		);
		value.position.copy(a).add(b).multiplyScalar(0.5);
		value.quaternion.setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			delta.normalize(),
		);
		return value;
	};
	// A closed, arched ram-air wing. Alternating sewn cells keep the paper style.
	const width = 4.8;
	const cells = 8;
	const roof = (x: number) => 2.9 + 0.65 * Math.cos((x / width) * Math.PI);
	for (let i = 0; i < cells; i++) {
		const x0 = -width / 2 + (i * width) / cells;
		const x1 = x0 + width / cells;
		const positions: number[] = [];
		for (const [x, y, z] of [
			[x0, roof(x0), -0.8],
			[x1, roof(x1), -0.8],
			[x1, roof(x1), 0.8],
			[x0, roof(x0), 0.8],
			[x0, roof(x0) - 0.18, -0.8],
			[x1, roof(x1) - 0.18, -0.8],
			[x1, roof(x1) - 0.18, 0.8],
			[x0, roof(x0) - 0.18, 0.8],
		] as [number, number, number][])
			positions.push(x, y, z);
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(positions, 3),
		);
		geometry.setIndex([
			0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0,
			4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
		]);
		geometry.computeVertexNormals();
		mesh(
			canopy,
			geometry,
			i === 3 || i === 4 ? gold : i % 2 ? paper : blue,
		).name = `canopy-cell-${i}`;
	}
	// Suspension fans meet the shoulder harness at the character attachment.
	for (const side of [-1, 1]) {
		const anchor = new THREE.Vector3(side * 0.22, 0, 0.08);
		for (const spread of [0.7, 1.5, 2.3]) {
			const x = side * spread;
			for (const z of [-0.72, 0.72])
				rod(
					canopy,
					anchor,
					new THREE.Vector3(x, roof(x) - 0.18, z),
					0.009,
					ink,
				);
		}
	}
	// No torso or upper-arm meshes in the first-person flight model.
	// These short forearms hold the brake toggles below the centre of the view.
	const hands: THREE.Mesh[] = [];
	for (const side of [-1, 1]) {
		const grip = new THREE.Vector3(side * 0.3, -0.2, -0.58);
		rod(
			controls,
			new THREE.Vector3(side * 0.4, -0.48, -0.34),
			grip,
			0.025,
			ink,
		);
		const hand = mesh(controls, new THREE.SphereGeometry(0.038, 8, 6), paper);
		hand.name = side < 0 ? "left-flight-hand" : "right-flight-hand";
		hand.position.copy(grip);
		hands.push(hand);
		const toggle = mesh(
			controls,
			new THREE.TorusGeometry(0.056, 0.012, 5, 10),
			gold,
		);
		toggle.position.copy(grip).add(new THREE.Vector3(0, 0.032, -0.008));
		rod(
			controls,
			grip.clone().add(new THREE.Vector3(0, 0.085, 0)),
			new THREE.Vector3(side * 0.38, 0.85, -0.68),
			0.005,
			ink,
		);
	}
	controls.traverse((node) => node.layers.set(1));
	return {
		canopy,
		controls,
		hands,
		/** Called after character interpolation, never from fixed-step simulation. */
		update(chest: Vec3, yaw: number, deployed: boolean): void {
			canopy.visible = controls.visible = deployed;
			canopy.position.copy(chest);
			canopy.rotation.set(0, yaw, 0);
		},
		dispose(): void {
			for (const geometry of geometries) geometry.dispose();
			for (const mat of materials) mat.dispose();
		},
	};
}
