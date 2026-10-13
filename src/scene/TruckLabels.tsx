import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { ACTIVE_TRUCK } from '../sim/engine';
import { useStore } from '../sim/store';
import { labelText, truckAnchors } from './Trucks';

/** Label elements by truck id, positioned every frame by <LabelProjector/>. */
const elements = new Map<string, HTMLDivElement>();
const v = new THREE.Vector3();

/** Lives inside the Canvas: projects each truck anchor to screen space. */
export function LabelProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => {
    for (const [id, el] of elements) {
      const anchor = truckAnchors.get(id);
      if (!anchor) {
        el.style.visibility = 'hidden';
        continue;
      }
      v.copy(anchor).project(camera);
      if (v.z > 1) {
        el.style.visibility = 'hidden';
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  });
  return null;
}

/** Lives outside the Canvas: plain DOM pills for trucks on site. */
export function TruckLabels() {
  const show = useStore((s) => s.showLabels);
  const selectedId = useStore((s) => (s.selection.kind === 'truck' ? s.selection.id : null));
  const trucks = useStore(
    useShallow((s) => s.sim.trucks.filter((t) => t.hubId === s.hubId && ACTIVE_TRUCK.has(t.status))),
  );
  return (
    <div className="scene-labels" aria-hidden>
      {trucks
        .filter((t) => show || t.id === selectedId)
        .map((t) => (
          <Label key={t.id} id={t.id} text={labelText(t)} selected={t.id === selectedId} />
        ))}
    </div>
  );
}

function Label({ id, text, selected }: { id: string; text: string; selected: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    elements.set(id, el);
    return () => {
      elements.delete(id);
    };
  }, [id]);
  return (
    <div ref={ref} className={`scene-tag${selected ? ' is-selected' : ''}`} style={{ visibility: 'hidden' }}>
      <b>{id}</b> {text}
    </div>
  );
}
