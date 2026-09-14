import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Monorepo singleton guard: @burst/game-client and web each resolve
    // R3F packages from their own node_modules. Without dedupe, Vite
    // bundles two fibers and <Physics> loses Canvas context (or hooks
    // mismatch across React/three copies). Force one copy.
    // NOTE: zustand is intentionally absent — leva needs its nested v3
    // while the game uses v5; the game only touches zustand through
    // @burst/game-client modules, so no singleton is required.
    dedupe: [
      'react',
      'react-dom',
      'three',
      '@dimforge/rapier3d-compat',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/rapier',
      '@react-three/postprocessing',
    ],
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
