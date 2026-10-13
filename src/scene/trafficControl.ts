/**
 * Shared, per-frame traffic signal. The gate guards (Guards.tsx) write it from the trucks'
 * movements; the road traffic (World.tsx) reads it. Plain module state — no React.
 */
export const traffic = {
  /** A truck is pulling in or out: both directions stop at their stop lines. */
  hold: false,
  /** x of trucks driving along the eastbound lane (arriving or leaving); cars stay behind them. */
  eastboundTrucks: [] as number[],
};

/**
 * Eastbound cars wait west of this x — behind the point where arriving trucks join the lane
 * (x = −150) — and westbound cars wait east of STOP_LINE_WEST, clear of the bays.
 */
export const STOP_LINE_EAST = -172;
export const STOP_LINE_WEST = 56;
