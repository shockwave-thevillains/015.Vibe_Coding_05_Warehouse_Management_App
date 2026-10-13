import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ACTIVE_TRUCK } from '../sim/engine';
import { useStore } from '../sim/store';
import type { Truck as TruckData, TruckColor } from '../sim/types';
import { truckPose, type Pose } from './layout';
import { C, logoTexture, stripeTexture } from './textures';

/** Live truck anchors (above the trailer) for the DOM label overlay; null while off-screen. */
export const truckAnchors = new Map<string, THREE.Vector3 | null>();

/** Sim time interpolated between 1 Hz ticks, so movement is smooth at any speed. */
export function smoothNow() {
  const st = useStore.getState();
  return st.sim.simNow + Math.min(performance.now() - st.lastTickPerf, 1200) * st.speed;
}

export function Trucks() {
  const ids = useStore((s) =>
    s.sim.trucks
      .filter((t) => t.hubId === s.hubId && ACTIVE_TRUCK.has(t.status))
      .map((t) => t.id)
      .join(','),
  );
  return (
    <>
      {ids
        .split(',')
        .filter(Boolean)
        .map((id) => (
          <Truck key={id} id={id} />
        ))}
    </>
  );
}

const TRAILER: Record<TruckColor, string> = { blue: C.blue, white: C.white, navy: C.navy };
const CAB: Record<TruckColor, string> = { blue: C.white, white: C.blue, navy: C.white };

function Truck({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pose = useMemo<Pose>(() => ({ x: 0, z: 0, yaw: 0, visible: false }), []);
  const yaw = useRef<number | null>(null);
  const color = useStore((s) => s.sim.trucks.find((t) => t.id === id)?.color ?? 'blue');
  const selected = useStore((s) => s.selection.kind === 'truck' && s.selection.id === id);
  const hovered = useStore((s) => s.hovered === `truck-${id}`);
  const select = useStore((s) => s.select);
  const setHovered = useStore((s) => s.setHovered);

  useFrame(({ clock }, delta) => {
    const t = useStore.getState().sim.trucks.find((x) => x.id === id);
    const g = ref.current;
    if (!t || !g) return;
    truckPose(t, smoothNow(), pose);
    g.visible = pose.visible;
    g.position.set(pose.x, 0, pose.z);
    // Ease heading changes (the switch from driving forward to reversing would otherwise snap).
    if (yaw.current === null) yaw.current = pose.yaw;
    let d = pose.yaw - yaw.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw.current += d * Math.min(1, delta * 6);
    g.rotation.y = yaw.current;
    if (pose.visible) {
      const a = truckAnchors.get(id) ?? new THREE.Vector3();
      truckAnchors.set(id, g.localToWorld(a.set(0, 5.4, -1.8)));
    } else {
      truckAnchors.set(id, null);
    }
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.06);
  });

  const glow = selected || hovered ? 0.25 : 0;
  const trailer = TRAILER[color];
  return (
    <group
      ref={ref}
      visible={false}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'truck', id }, true);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(`truck-${id}`);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
    >
      {/* trailer */}
      <mesh position={[0, 2.55, -1.8]} castShadow>
        <boxGeometry args={[2.6, 3.3, 11]} />
        <meshStandardMaterial color={trailer} emissive={C.blue} emissiveIntensity={glow} />
      </mesh>
      {color === 'blue' ? (
        [1, -1].map((side) => (
          <mesh key={side} position={[1.31 * side, 2.7, -1.8]} rotation-y={(side * Math.PI) / 2}>
            <planeGeometry args={[7.6, 1.9]} />
            <meshBasicMaterial map={logoTexture()} transparent toneMapped={false} />
          </mesh>
        ))
      ) : (
        [1, -1].map((side) => (
          <mesh key={side} position={[1.31 * side, 2.55, -1.8]} rotation-y={(side * Math.PI) / 2}>
            <planeGeometry args={[11, 3.3]} />
            <meshStandardMaterial map={color === 'white' ? stripeTexture() : null} color={color === 'white' ? '#ffffff' : C.navy} />
          </mesh>
        ))
      )}
      {/* chassis */}
      <mesh position={[0, 0.75, -0.5]}>
        <boxGeometry args={[2.2, 0.35, 13.4]} />
        <meshStandardMaterial color="#3b4252" />
      </mesh>
      {/* cab */}
      <mesh position={[0, 1.95, 5.25]} castShadow>
        <boxGeometry args={[2.5, 2.7, 2.6]} />
        <meshStandardMaterial color={CAB[color]} emissive={C.blue} emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, 2.55, 6.56]}>
        <planeGeometry args={[2.2, 1.1]} />
        <meshStandardMaterial color={C.glass} roughness={0.2} metalness={0.4} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[1.26 * side, 2.55, 5.55]} rotation-y={(side * Math.PI) / 2}>
          <planeGeometry args={[1.2, 0.9]} />
          <meshStandardMaterial color={C.glass} roughness={0.2} metalness={0.4} />
        </mesh>
      ))}
      {/* wheels */}
      {[-6, -4.8, 3.6, 5.6].flatMap((z) =>
        [1, -1].map((side) => (
          <mesh key={`${z}${side}`} position={[1.12 * side, 0.55, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.55, 0.55, 0.4, 14]} />
            <meshStandardMaterial color={C.rubber} />
          </mesh>
        )),
      )}
      {selected && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.06, -0.4]}>
          <ringGeometry args={[7.6, 8.1, 48]} />
          <meshBasicMaterial color={C.blue} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

export function labelText(t: TruckData) {
  if (t.status === 'arriving') return `· Bay ${t.bay! + 1}`;
  if (t.status === 'departing') return '· Departing';
  if (t.status === 'docked') return `· ${t.direction === 'inbound' ? 'Unloading' : 'Loading'} ${Math.round(t.progress * 100)}%`;
  return '';
}
