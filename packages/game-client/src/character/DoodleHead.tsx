import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS, css } from "../rendering/palette";

/**
 * Doodle head: circular paper face, ink dots, scribble hair.
 * Parent drives position/rotation; this only owns local face decoration.
 */
export function DoodleHead({
	teamColor = COLORS.characterShirt,
}: {
	teamColor?: number;
}) {
	const blink = useRef(0);
	const eyeL = useRef<THREE.Mesh>(null);
	const eyeR = useRef<THREE.Mesh>(null);
	const paper = css(COLORS.characterPaper);
	const ink = css(COLORS.characterInk);

	useFrame((_, dt) => {
		blink.current += dt;
		if (blink.current > 3.2) blink.current = 0;
		const open = blink.current < 0.08 ? 0.15 : 1;
		eyeL.current?.scale.set(1, open, 1);
		eyeR.current?.scale.set(1, open, 1);
	});

	return (
		<group rotation={[0, Math.PI, 0]}>
			{/* Face features are authored on +Z; yaw 0 looks down -Z, so flip. */}
			<mesh>
				<sphereGeometry args={[0.24, 12, 10]} />
				<meshLambertMaterial color={paper} flatShading />
			</mesh>
			<mesh scale={1.04}>
				<sphereGeometry args={[0.24, 12, 10]} />
				<meshBasicMaterial
					color={ink}
					transparent
					opacity={0.12}
					side={THREE.BackSide}
				/>
			</mesh>
			<mesh ref={eyeL} position={[-0.08, 0.03, 0.21]}>
				<sphereGeometry args={[0.035, 6, 6]} />
				<meshBasicMaterial color={ink} />
			</mesh>
			<mesh ref={eyeR} position={[0.08, 0.03, 0.21]}>
				<sphereGeometry args={[0.035, 6, 6]} />
				<meshBasicMaterial color={ink} />
			</mesh>
			<mesh position={[0, -0.07, 0.22]} rotation={[0, 0, Math.PI]}>
				<torusGeometry args={[0.05, 0.012, 4, 8, Math.PI]} />
				<meshBasicMaterial color={ink} />
			</mesh>
			<mesh position={[0, 0.22, 0.02]} rotation={[0.4, 0, 0]}>
				<boxGeometry args={[0.02, 0.1, 0.02]} />
				<meshLambertMaterial color={ink} flatShading />
			</mesh>
			<mesh position={[-0.06, 0.2, 0.04]} rotation={[0.2, 0, -0.3]}>
				<boxGeometry args={[0.02, 0.08, 0.02]} />
				<meshLambertMaterial color={ink} flatShading />
			</mesh>
			<mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.06, 8]} />
				<meshBasicMaterial color={css(teamColor)} />
			</mesh>
		</group>
	);
}
