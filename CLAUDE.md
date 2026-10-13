# CLAUDE.md — Hubline Warehouse Ops

Vite + React 19 + TypeScript + React Three Fiber 9 / drei 10 + zustand 5. Static site deployed to
GitHub Pages by `.github/workflows/deploy.yml` on push to `main`. UI copy is English (US spelling).

## Commands

```sh
npm run dev       # dev server
npm test          # vitest — src/sim/engine.test.ts
npm run build     # tsc -b && vite build — must pass before committing
```

## Architecture

- `src/sim/` is pure TS. `step(state, dt)` clones and advances; user actions are pure functions
  returning a new state. Keep React/three out of it. Bump `STATE_VERSION` (seed.ts) whenever the
  `SimState` shape changes — old saves are then discarded instead of crashing.
- `store.ts` ticks once per second (`App.tsx`), persists to localStorage through a storage wrapper
  that never throws. Selectors that return filtered arrays must use `useShallow`.
- The 3D scene reads the store in `useFrame` via `useStore.getState()` and interpolates between ticks
  with `smoothNow()`. Truck movement is derived from `truckPose()` (curves in `scene/layout.ts`).
- `scene/zones.ts` must stay free of three.js imports (UI imports it; keeps three out of the main chunk).
- Truck labels are a DOM overlay (`TruckLabels.tsx`) projected each frame — drei `<Html>` dropped labels.
- Desktop: overlays float over a full-screen canvas; `ViewOffset` shifts the projection so the yard
  centers left of the side panel. ≤900px: everything stacks and the page scrolls.

## Verifying visually

Chromium for Playwright is at `/opt/pw-browsers`; launch with
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL in headless mode.
