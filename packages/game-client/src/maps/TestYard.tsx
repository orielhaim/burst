import { COLORS } from "../rendering/palette";
import { Crate, Floor, Pillar, Platform, Ramp, SolidBox, SpawnPoint, Wall } from "./primitives";

/**
 * Test Yard as declarative R3F composition. Solids mirror the legacy
 * `test-map.ts` layout (same positions/sizes) so gameplay behavior is
 * preserved; each primitive owns its mesh + collider together.
 */
export function TestYard() {
	const half = 35;
	const wallH = 3.2;
	return (
		<group name="map:test-yard">
			<Floor position={[0, -0.5, 0]} size={[72, 1, 72]} />

			<Wall from={[-half, 0, -half]} to={[half, 0, -half]} height={wallH} />
			<Wall from={[half, 0, -half]} to={[half, 0, half]} height={wallH} />
			<Wall from={[half, 0, half]} to={[-half, 0, half]} height={wallH} />
			<Wall from={[-half, 0, half]} to={[-half, 0, -half]} height={wallH} />

			<SolidBox position={[0, 0.75, 0]} size={[3.2, 1.5, 3.2]} />
			<SolidBox position={[-6, 0.6, 4]} size={[2.2, 1.2, 2.2]} />
			<SolidBox position={[6, 0.6, -4]} size={[2.2, 1.2, 2.2]} />

			<Platform position={[-8, 0.5, -8]} size={[4, 1, 4]} />
			<Platform position={[8, 1.1, 8]} size={[3.5, 2.2, 3.5]} />
			<Platform position={[8, 0.4, -9]} size={[3, 0.8, 3]} />

			<Ramp
				position={[4.2, 0.7, 8]}
				size={[4.5, 0.35, 3.2]}
				pitch={-0.42}
				color={COLORS.accent}
			/>
			<Ramp
				position={[-12, 0.55, 2]}
				size={[3.5, 0.35, 5]}
				pitch={0.35}
				color={COLORS.accent}
			/>

			<Pillar position={[-3, 0, -6]} height={4.5} width={0.9} />
			<Pillar position={[3, 0, 6]} height={4.5} width={0.9} />
			<Pillar position={[12, 0, -2]} height={3.2} width={1.0} />
			<Pillar position={[-12, 0, -2]} height={3.2} width={1.0} />

			<SolidBox position={[-10, 0.45, 10]} size={[8, 0.9, 0.5]} />
			<SolidBox position={[10, 0.45, -10]} size={[8, 0.9, 0.5]} />

			<SolidBox
				position={[-14, 1.0, -14]}
				size={[3, 2, 3]}
				color={COLORS.platform}
			/>
			<SolidBox
				position={[14, 1.0, 14]}
				size={[3, 2, 3]}
				color={COLORS.platform}
			/>

			{/* Movement test lane */}
			<SolidBox
				position={[23, 0.03, 0]}
				size={[8, 0.06, 52]}
				color={COLORS.platform}
			/>
			<SolidBox position={[23, 1.5, -8]} size={[8, 3, 0.05]} />
			<SolidBox position={[19, 1.5, -14]} size={[0.15, 3, 7]} />
			<SolidBox position={[22.5, 1.5, -17.5]} size={[7, 3, 0.15]} />
			{[0, 1, 2, 3, 4].map((index) => (
				<SolidBox
					key={index}
					position={[20 + index * 0.7, 0.1 + index * 0.1, 10]}
					size={[0.7, 0.2 + index * 0.2, 3]}
					color={COLORS.platform}
				/>
			))}
			<Ramp
				position={[22, 0.5, 17]}
				size={[3.5, 0.3, 7]}
				pitch={-0.2}
				color={COLORS.accent}
			/>
			<Ramp
				position={[27, 1.1, 17]}
				size={[3.5, 0.3, 5]}
				pitch={-0.62}
				color={COLORS.accent}
			/>
			<Ramp
				position={[22, 1.2, 26]}
				size={[4, 0.3, 9]}
				pitch={0.32}
				color={COLORS.accent}
			/>
			<SolidBox position={[29, 1.35, 5]} size={[7, 0.25, 5]} />
			<SolidBox position={[27, 1.8, -26]} size={[0.3, 3.6, 8]} />
			<SolidBox position={[30, 1.8, -26]} size={[0.3, 3.6, 8]} />

			{/* Dynamic props */}
			<Crate position={[2.5, 0.5, 5]} />
			<Crate position={[-2.5, 0.5, -5]} size={0.7} />

			<SpawnPoint position={[0, 1.2, 12]} yaw={0} />
			<SpawnPoint position={[0, 1.2, -12]} yaw={Math.PI} />
			<SpawnPoint position={[10, 1.2, 0]} yaw={Math.PI / 2} />
			<SpawnPoint position={[-10, 1.2, 0]} yaw={-Math.PI / 2} />
		</group>
	);
}
