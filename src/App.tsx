import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
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

/** "H" hides / shows every panel, unless the user is typing. */
function useHideShortcut() {
  const toggleUi = useStore((s) => s.toggleUi);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      toggleUi();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleUi]);
}

export default function App() {
  useSimClock();
  useHideShortcut();
  const uiHidden = useStore((s) => s.uiHidden);
  const toggleUi = useStore((s) => s.toggleUi);
  const webgl = hasWebGL();
  return (
    <div className={`app${uiHidden ? ' ui-hidden' : ''}`}>
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
      <div className="panels" aria-hidden={uiHidden} inert={uiHidden}>
        <TopBar />
        <KpiCards />
        <div className="side">
          <DetailPanel />
          <OpsTabs />
        </div>
        <ShipmentTracker />
      </div>
      {uiHidden && (
        <button className="restore-pill card" onClick={toggleUi}>
          <Maximize2 size={15} /> Show panels <kbd>H</kbd>
        </button>
      )}
    </div>
  );
}
