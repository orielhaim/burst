import type { InputFrame } from "./types";
export type Action =
	| "moveForward"
	| "moveBackward"
	| "moveLeft"
	| "moveRight"
	| "jump"
	| "primaryFire"
	| "aim"
	| "sprint"
	| "crouch"
	| "reload"
	| "melee"
	| "specialAbility";

export type ActionBindings = Record<Action, string[]>;

const DEFAULT_BINDINGS: ActionBindings = {
	moveForward: ["KeyW", "ArrowUp"],
	moveBackward: ["KeyS", "ArrowDown"],
	moveLeft: ["KeyA", "ArrowLeft"],
	moveRight: ["KeyD", "ArrowRight"],
	jump: ["Space"],
	primaryFire: ["Mouse0"],
	aim: ["Mouse2"],
	sprint: ["ShiftLeft", "ShiftRight"],
	crouch: ["ControlLeft", "ControlRight"],
	reload: ["KeyR"],
	melee: ["KeyF"],
	specialAbility: ["KeyQ"],
};

/**
 * Centralized action-based input.
 * Systems read named actions; raw DOM bindings stay here.
 */
export class Input {
	private readonly element: HTMLElement;
	private bindings: ActionBindings;
	private readonly held = new Set<Action>();
	private readonly pressed = new Set<Action>();
	private readonly released = new Set<Action>();
	private readonly downCodes = new Set<string>();
	private readonly codeToActions = new Map<string, Action[]>();
	private wheel = 0;
	private lastWheel = -Infinity;
	private lookX = 0;
	private lookY = 0;
	private _pointerLocked = false;
	private attached = false;
	private onPointerLockChange?: (locked: boolean) => void;

	constructor(
		element: HTMLElement,
		bindings: ActionBindings = DEFAULT_BINDINGS,
	) {
		this.element = element;
		this.bindings = { ...bindings };
		this.rebuildIndex();
	}

	private rebuildIndex(): void {
		this.codeToActions.clear();
		for (const [action, codes] of Object.entries(this.bindings) as [
			Action,
			string[],
		][]) {
			for (const code of codes) {
				const list = this.codeToActions.get(code) ?? [];
				list.push(action);
				this.codeToActions.set(code, list);
			}
		}
	}

	setBindings(bindings: ActionBindings): void {
		this.bindings = { ...bindings };
		this.rebuildIndex();
	}

	attach(): void {
		if (this.attached) return;
		this.attached = true;
		this.element.addEventListener("wheel", this.onWheel, { passive: false });
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("mousemove", this.onMouseMove);
		window.addEventListener("mousedown", this.onMouseDown);
		window.addEventListener("mouseup", this.onMouseUp);
		this.element.addEventListener("contextmenu", this.onContextMenu);
		document.addEventListener("pointerlockchange", this.onPointerLockChanged);
		window.addEventListener("blur", this.onBlur);
	}

	detach(): void {
		if (!this.attached) return;
		this.attached = false;
		this.element.removeEventListener("wheel", this.onWheel);
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		window.removeEventListener("mousemove", this.onMouseMove);
		window.removeEventListener("mousedown", this.onMouseDown);
		window.removeEventListener("mouseup", this.onMouseUp);
		this.element.removeEventListener("contextmenu", this.onContextMenu);
		document.removeEventListener(
			"pointerlockchange",
			this.onPointerLockChanged,
		);
		window.removeEventListener("blur", this.onBlur);
		this.held.clear();
		this.pressed.clear();
		this.released.clear();
		this.downCodes.clear();
		this.wheel = 0;
		this.lookX = 0;
		this.lookY = 0;
	}

	setPointerLockListener(cb: ((locked: boolean) => void) | undefined): void {
		this.onPointerLockChange = cb;
	}

	get pointerLocked(): boolean {
		return this._pointerLocked;
	}

	requestPointerLock(): void {
		const el = this.element as HTMLElement & {
			requestPointerLock?: (options?: {
				unadjustedMovement?: boolean;
			}) => Promise<void> | void;
		};
		const requestFallback = () => {
			try {
				const fallback = el.requestPointerLock?.();
				if (fallback instanceof Promise) fallback.catch(() => undefined);
			} catch {
				// The pause overlay remains available when pointer lock is denied.
			}
		};
		try {
			const result = el.requestPointerLock?.({ unadjustedMovement: true });
			if (result instanceof Promise) {
				result.catch(requestFallback);
			}
		} catch {
			requestFallback();
		}
	}

	exitPointerLock(): void {
		if (document.pointerLockElement === this.element) {
			document.exitPointerLock();
		}
	}

	isDown(action: Action): boolean {
		return this.held.has(action);
	}

	/** Accumulated look delta since last call (pixels). */
	consumeLookDelta(): { x: number; y: number } {
		const x = this.lookX;
		const y = this.lookY;
		this.lookX = 0;
		this.lookY = 0;
		return { x, y };
	}

	/**
	 * Snapshot current action state for this simulation step.
	 * Look deltas are consumed here so each step sees fresh mouse motion.
	 */
	captureFrame(): InputFrame {
		const look = this.consumeLookDelta();
		const forward = this.held.has("moveForward") ? 1 : 0;
		const backward = this.held.has("moveBackward") ? 1 : 0;
		const left = this.held.has("moveLeft") ? 1 : 0;
		const right = this.held.has("moveRight") ? 1 : 0;
		const frame = {
			weaponCycle: this.wheel,
			meleePressed: this.pressed.has("melee") && this._pointerLocked,
			meleeHeld: this.held.has("melee") && this._pointerLocked,
			moveX: right - left,
			moveZ: forward - backward,
			jumpPressed: this.pressed.has("jump"),
			jumpHeld: this.held.has("jump"),
			primaryFireHeld: this.held.has("primaryFire") && this._pointerLocked,
			primaryFirePressed:
				this.pressed.has("primaryFire") && this._pointerLocked,
			primaryFireReleased: this.released.has("primaryFire"),
			aimHeld: this.held.has("aim") && this._pointerLocked,
			aimPressed: this.pressed.has("aim") && this._pointerLocked,
			aimReleased: this.released.has("aim"),
			sprintHeld: this.held.has("sprint"),
			crouchHeld: this.held.has("crouch"),
			crouchPressed: this.pressed.has("crouch"),
			reloadPressed: this.pressed.has("reload"),
			specialAbilityPressed: this.pressed.has("specialAbility") && this._pointerLocked,
			lookX: this._pointerLocked ? look.x : 0,
			lookY: this._pointerLocked ? look.y : 0,
		};
		this.pressed.clear();
		this.released.clear();
		this.wheel = 0;
		return frame;
	}

	private applyCode(code: string, down: boolean): void {
		const actions = this.codeToActions.get(code);
		if (!actions) return;
		if (down) this.downCodes.add(code);
		else this.downCodes.delete(code);
		for (const action of actions) {
			const wasHeld = this.held.has(action);
			const isHeld = this.bindings[action].some((binding) =>
				this.downCodes.has(binding),
			);
			if (isHeld) this.held.add(action);
			else this.held.delete(action);
			if (!wasHeld && isHeld) this.pressed.add(action);
			if (wasHeld && !isHeld) this.released.add(action);
		}
	}

	private onWheel = (event: WheelEvent): void => {
		if (!this._pointerLocked || event.deltaY === 0) return;
		event.preventDefault();
		if (event.timeStamp - this.lastWheel < 100) return;
		this.lastWheel = event.timeStamp;
		this.wheel = Math.sign(event.deltaY);
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.repeat) return;
		this.applyCode(event.code, true);
	};

	private onKeyUp = (event: KeyboardEvent): void => {
		this.applyCode(event.code, false);
	};

	private onMouseMove = (event: MouseEvent): void => {
		if (!this._pointerLocked) return;
		this.lookX += event.movementX;
		this.lookY += event.movementY;
	};

	private onMouseDown = (event: MouseEvent): void => {
		if (!this._pointerLocked) return;
		this.applyCode(`Mouse${event.button}`, true);
	};

	private onMouseUp = (event: MouseEvent): void => {
		this.applyCode(`Mouse${event.button}`, false);
	};

	private onContextMenu = (event: Event): void => {
		if (this._pointerLocked) event.preventDefault();
	};

	private onPointerLockChanged = (): void => {
		const locked = document.pointerLockElement === this.element;
		this._pointerLocked = locked;
		if (!locked) {
			this.held.delete("primaryFire");
			this.held.delete("aim");
			this.pressed.delete("primaryFire");
			this.pressed.delete("aim");
			this.released.delete("primaryFire");
			this.released.delete("aim");
			this.downCodes.delete("Mouse0");
			this.downCodes.delete("Mouse2");
			this.lookX = 0;
			this.lookY = 0;
		}
		this.onPointerLockChange?.(locked);
	};

	private onBlur = (): void => {
		this.held.clear();
		this.pressed.clear();
		this.released.clear();
		this.downCodes.clear();
		this.wheel = 0;
		this.lookX = 0;
		this.lookY = 0;
	};
}
