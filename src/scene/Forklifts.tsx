import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../sim/store';
import { CHARGER_SLOTS, FORKLIFT_LOOPS, forkliftRest } from './layout';
import { C } from './textures';

export function Forklifts() {
  const list = useStore((s) =>
    s.sim.forklifts
      .filter((f) => f.hubId === s.hubId)
      .map((f) => `${f.id}:${f.status}`)
      .join(','),
  );
  const entries = list ? list.split(',').map((e) => e.split(':') as [string, string]) : [];
  return (
    <>
      {entries.map(([id, status], i) => (
        <Forklift key={id} id={id} index={i} status={status} />
      ))}
      {Array.from({ length: CHARGER_SLOTS * 2 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const p = { x: side * 29.2, z: 3 - Math.floor(i / 2) * 2.8 };
        return (
          <group key={i} position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[0.6, 1.8, 1]} />
              <meshStandardMaterial color="#e5e9f0" />
            </mesh>
            <mesh position={[-0.31 * side, 1.3, 0]}>
              <boxGeometry args={[0.02, 0.25, 0.5]} />
              <meshBasicMaterial color="#22c55e" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

const tmp = new THREE.Vector3();

/** Live forklift positions, read by the camera when it flies to a selected forklift. */
export const forkliftPositions = new Map<string, THREE.Vector3>();

function Forklift({ id, index, status }: { id: string; index: number; status: string }) {
  const ref = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const u = useRef(index * 0.37);
  const placed = useRef(false);
  const selected = useStore((s) => s.selection.kind === 'forklift' && s.selection.id === id);
  const hovered = useStore((s) => s.hovered === `forklift-${id}`);
  const select = useStore((s) => s.select);
  const setHovered = useStore((s) => s.setHovered);
  const curve = FORKLIFT_LOOPS[index % FORKLIFT_LOOPS.length];

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const speed = useStore.getState().speed;
    let target: THREE.Vector3;
    if (status === 'active') {
      const rate = speed === 0 ? 0 : speed === 1 ? 1 : 1.8;
      u.current = (u.current + (delta * 3.2 * rate) / curve.getLength()) % 1;
      target = curve.getPointAt(u.current, tmp);
      if (load.current) load.current.visible = u.current % 0.5 < 0.25;
    } else {
      target = forkliftRest(index, status === 'charging');
      if (load.current) load.current.visible = false;
    }
    forkliftPositions.set(id, g.position);
    if (!placed.current) {
      g.position.copy(target);
      placed.current = true;
      return;
    }
    const dx = target.x - g.position.x;
    const dz = target.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.02) {
      // Drive toward the target; parked trucks back in facing the wall.
      const step = Math.min(dist, Math.max(delta * 6, dist * Math.min(1, delta * 4)));
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      const want = Math.atan2(dx, dz);
      let d = want - g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.rotation.y += d * Math.min(1, delta * 8);
    }
  });

  const glow = selected || hovered ? 0.35 : 0;
  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'forklift', id }, true);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(`forklift-${id}`);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
    >
      <mesh position={[0, 0.75, -0.1]} castShadow>
        <boxGeometry args={[1.25, 0.9, 1.9]} />
        <meshStandardMaterial color={C.forklift} emissive={C.forklift} emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, 0.85, -1]} castShadow>
        <boxGeometry args={[1.2, 0.8, 0.5]} />
        <meshStandardMaterial color="#3b4252" />
      </mesh>
      {/* overhead guard */}
      {[-0.5, 0.5].flatMap((x) =>
        [-0.6, 0.45].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.75, z]}>
            <boxGeometry args={[0.08, 1.1, 0.08]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.3, -0.08]} castShadow>
        <boxGeometry args={[1.15, 0.08, 1.2]} />
        <meshStandardMaterial color="#2a2f3a" />
      </mesh>
      {/* mast + forks */}
      <mesh position={[0, 1.4, 0.95]}>
        <boxGeometry args={[0.9, 2.4, 0.12]} />
        <meshStandardMaterial color="#2a2f3a" />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.25, 1.55]}>
          <boxGeometry args={[0.12, 0.06, 1.2]} />
          <meshStandardMaterial color="#5b6475" />
        </mesh>
      ))}
      <group ref={load} position={[0, 0.3, 1.6]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[1.1, 0.16, 1.1]} />
          <meshStandardMaterial color={C.pallet} />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1, 0.8, 1]} />
          <meshStandardMaterial color={C.box} />
        </mesh>
      </group>
      {[-0.55, 0.55].flatMap((x) =>
        [-0.7, 0.55].map((z) => (
          <mesh key={`w${x}${z}`} position={[x * 1.1, 0.3, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.3, 0.3, 0.25, 12]} />
            <meshStandardMaterial color={C.rubber} />
          </mesh>
        )),
      )}
      {(selected || status === 'charging') && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0.2]}>
          <ringGeometry args={[1.7, 1.95, 32]} />
          <meshBasicMaterial color={status === 'charging' && !selected ? '#22c55e' : C.blue} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}
