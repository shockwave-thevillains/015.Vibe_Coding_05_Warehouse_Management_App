import { House, Minus, Mountain, Plus, Tag } from 'lucide-react';
import { useStore } from '../sim/store';

export function MapControls() {
  const zoom = useStore((s) => s.zoom);
  const showLabels = useStore((s) => s.showLabels);
  const toggleLabels = useStore((s) => s.toggleLabels);
  const select = useStore((s) => s.select);
  return (
    <div className="map-controls card" role="toolbar" aria-label="Map controls">
      <button onClick={() => zoom(1)} aria-label="Zoom in" title="Zoom in">
        <Plus size={17} />
      </button>
      <button onClick={() => zoom(-1)} aria-label="Zoom out" title="Zoom out">
        <Minus size={17} />
      </button>
      <button
        onClick={() => {
          select({ kind: 'hub' });
          zoom(0);
        }}
        aria-label="Reset view"
        title="Reset view"
      >
        <House size={16} />
      </button>
      <button
        onClick={() => {
          select({ kind: 'hub' });
          zoom('panorama');
        }}
        aria-label="Panorama view"
        title="Panorama view"
      >
        <Mountain size={16} />
      </button>
      <button onClick={toggleLabels} aria-pressed={showLabels} aria-label="Truck labels" title="Truck labels">
        <Tag size={16} />
      </button>
    </div>
  );
}
