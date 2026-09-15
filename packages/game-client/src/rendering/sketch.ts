import * as THREE from "three";
import { COLORS, css } from "./palette";

const textureCache = new Map<string, THREE.CanvasTexture>();

function canvas2d(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d canvas unavailable");
	return [canvas, ctx];
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.anisotropy = 4;
	return texture;
}

function cached(key: string, build: () => THREE.CanvasTexture): THREE.CanvasTexture {
	const hit = textureCache.get(key);
	if (hit) return hit;
	const texture = build();
	textureCache.set(key, texture);
	return texture;
}

/** Lined notebook page — cream paper, blue rules, red margin. */
export function linedPaperTexture(): THREE.CanvasTexture {
	return cached("lined-paper", () => {
		const [canvas, ctx] = canvas2d(512);
		ctx.fillStyle = css(COLORS.paper);
		ctx.fillRect(0, 0, 512, 512);
		for (let i = 0; i < 900; i++) {
			ctx.fillStyle = `rgba(80,60,40,${0.015 + Math.random() * 0.02})`;
			ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
		}
		ctx.strokeStyle = "rgba(111,148,196,0.55)";
		ctx.lineWidth = 1.4;
		for (let y = 40; y < 512; y += 32) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(512, y);
			ctx.stroke();
		}
		ctx.strokeStyle = "rgba(217,100,88,0.5)";
		ctx.lineWidth = 1.8;
		ctx.beginPath();
		ctx.moveTo(72, 0);
		ctx.lineTo(72, 512);
		ctx.stroke();
		return finish(canvas);
	});
}

/** Warm wood desk grain for the slab top. */
export function deskWoodTexture(): THREE.CanvasTexture {
	return cached("desk-wood", () => {
		const [canvas, ctx] = canvas2d(512);
		ctx.fillStyle = css(COLORS.deskTop);
		ctx.fillRect(0, 0, 512, 512);
		for (let i = 0; i < 48; i++) {
			const y = Math.random() * 512;
			const h = 2 + Math.random() * 8;
			ctx.fillStyle = `rgba(120,80,40,${0.04 + Math.random() * 0.08})`;
			ctx.fillRect(0, y, 512, h);
		}
		for (let i = 0; i < 24; i++) {
			ctx.strokeStyle = `rgba(90,60,30,${0.05 + Math.random() * 0.08})`;
			ctx.lineWidth = 1 + Math.random() * 2;
			ctx.beginPath();
			const y0 = Math.random() * 512;
			ctx.moveTo(0, y0);
			ctx.bezierCurveTo(128, y0 + 8, 384, y0 - 10, 512, y0 + 4);
			ctx.stroke();
		}
		return finish(canvas);
	});
}

/** Blank aged paper (covers, slips, book pages). */
export function blankPaperTexture(tint = COLORS.paperWarm): THREE.CanvasTexture {
	return cached(`blank-paper-${tint}`, () => {
		const [canvas, ctx] = canvas2d(256);
		ctx.fillStyle = css(tint);
		ctx.fillRect(0, 0, 256, 256);
		for (let i = 0; i < 400; i++) {
			ctx.fillStyle = `rgba(70,50,30,${0.02 + Math.random() * 0.03})`;
			ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
		}
		return finish(canvas);
	});
}

export function sketchMaterial(color: number, options?: { map?: THREE.Texture }): THREE.MeshLambertMaterial {
	return new THREE.MeshLambertMaterial({
		color,
		map: options?.map,
		flatShading: true,
	});
}
