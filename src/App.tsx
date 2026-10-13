import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { useStore } from './sim/store';
import { DetailPanel } from './ui/DetailPanel';
import { KpiCards } from './ui/KpiCards';
import { MapControls } from './ui/MapControls';
import { OpsTabs } from './ui/OpsTabs';
import { ShipmentTracker } from './ui/ShipmentTracker';
import { TopBar } from './ui/TopBar';

const Scene = lazy(() => import('./scene/Scene'));

function useSimClock() {
  const tick = useStore((s) => s.tick);
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // Background tabs throttle timers; cap the catch-up so one tick stays cheap.
      tick(Math.min(now - last, 60_000));
      last = now;
    }, 1000);
    return () => window.clearInterval(id);
  }, [tick]);
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <SceneFallback reason="The 3D map couldn't start on this device." /> : this.props.children;
  }
}

function SceneFallback({ reason }: { reason: string }) {
  return (
    <div className="scene-fallback">
      <p>{reason}</p>
      <p className="muted">Everything else on the dashboard still updates live.</p>
    </div>
  );
}

export default function App() {
  useSimClock();
  const webgl = hasWebGL();
  return (
    <div className="app">
      <div className="scene">
        {webgl ? (
          <SceneBoundary>
            <Suspense fallback={<div className="scene-loading">Loading yard map…</div>}>
              <Scene />
            </Suspense>
          </SceneBoundary>
        ) : (
          <SceneFallback reason="Your browser has WebGL turned off, so the 3D map is hidden." />
        )}
        <MapControls />
      </div>
      <TopBar />
      <KpiCards />
      <div className="side">
        <DetailPanel />
        <OpsTabs />
      </div>
      <ShipmentTracker />
    </div>
  );
}
