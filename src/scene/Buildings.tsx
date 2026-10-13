import { Instance, Instances } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BAY_COUNT } from '../sim/constants';
import { useStore } from '../sim/store';
import type { DockState } from '../sim/types';
import { DOCK_FACE_Z, ZONES, bayX, type Zone } from './layout';
import { C, bayTexture, logoTexture } from './textures';

function useHoverable(key: string, onSelect: () => void) {
  const setHovered = useStore((s) => s.setHovered);
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(key);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHovered(null);
      document.body.style.cursor = '';
    },
  };
}

export function Buildings() {
  return (
    <>
      {ZONES.map((z) =>
        z.id === 'office' ? <Office key={z.id} zone={z} /> : <Shed key={z.id} zone={z} white={z.id === 'cold'} />,
      )}
      <DockDoors />
    </>
  );
}

function roofGeometry(w: number, d: number, rise: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.4, 0);
  shape.lineTo(d / 2 + 0.4, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w + 0.8, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-(w + 0.8) / 2, 0, 0);
  return g;
}

/** A gabled storage shed: ribbed walls, pitched roof, rooftop units and a map pin. */
function Shed({ zone, white = false }: { zone: Zone; white?: boolean }) {
  const select = useStore((s) => s.select);
  const isHovered = useStore((s) => s.hovered === `zone-${zone.id}`);
  const isSelected = useStore(
    (s) => (s.selection.kind === 'zone' && s.selection.id === zone.id) || (zone.id === 'main' && s.selection.kind === 'hub'),
  );
  const handlers = useHoverable(`zone-${zone.id}`, () =>
    select(zone.id === 'main' ? { kind: 'hub' } : { kind: 'zone', id: zone.id }, true),
  );
  const roof = useMemo(() => roofGeometry(zone.w, zone.d, zone.d * 0.14), [zone]);
  const ribs = useMemo(() => {
    const out: number[] = [];
    for (let x = -zone.w / 2 + 1.2; x < zone.w / 2 - 0.6; x += 2.4) out.push(x);
    return out;
  }, [zone.w]);
  const wall = white ? C.white : C.blue;
  const glow = isHovered ? 0.12 : 0;

  return (
    <group position={[zone.x, 0, zone.z]}>
      <group {...handlers}>
        <mesh position={[0, zone.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[zone.w, zone.h, zone.d]} />
          <meshStandardMaterial color={wall} emissive={wall} emissiveIntensity={glow} />
        </mesh>
        <mesh geometry={roof} position={[0, zone.h, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={white ? C.blue : C.blueRoof} emissive={C.blueRoof} emissiveIntensity={glow} />
        </mesh>
      </group>
      {/* wall ribs, front and back */}
      <Instances limit={64} castShadow>
        <boxGeometry args={[0.35, zone.h - 0.4, 0.2]} />
        <meshStandardMaterial color={white ? '#dfe6f2' : C.blueRib} />
        {ribs.flatMap((x) => [
          <Instance key={`f${x}`} position={[x, zone.h / 2, zone.d / 2 + 0.1]} />,
          <Instance key={`b${x}`} position={[x, zone.h / 2, -zone.d / 2 - 0.1]} />,
        ])}
      </Instances>
      {/* white trim along the eaves */}
      <mesh position={[0, zone.h - 0.25, zone.d / 2 + 0.22]}>
        <boxGeometry args={[zone.w + 0.2, 0.5, 0.12]} />
        <meshStandardMaterial color={white ? C.blue : C.white} />
      </mesh>
      {/* rooftop plant */}
      {[-0.25, 0.2].map((f) => (
        <mesh key={f} position={[zone.w * f, zone.h + zone.d * 0.14 * 0.55, -zone.d * 0.12]} castShadow>
          <boxGeometry args={[2.2, 1, 1.6]} />
          <meshStandardMaterial color="#cfd6e2" />
        </mesh>
      ))}
      {zone.id === 'main' && (
        <mesh position={[-zone.w / 2 + 7.5, zone.h - 1.9, zone.d / 2 + 0.25]}>
          <planeGeometry args={[11, 2.75]} />
          <meshBasicMaterial map={logoTexture()} transparent toneMapped={false} />
        </mesh>
      )}
      {zone.id === 'crossdock' && <SideDoors w={zone.w} d={zone.d} />}
      <Pin y={zone.h + zone.d * 0.14 + 3.2} active={isSelected} onSelect={handlers.onClick} hoverKey={`zone-${zone.id}`} />
    </group>
  );
}

function SideDoors({ w, d }: { w: number; d: number }) {
  return (
    <>
      {[-w / 4, w / 4].map((x) => (
        <mesh key={x} position={[x, 2.3, d / 2 + 0.12]}>
          <boxGeometry args={[4, 4.6, 0.1]} />
          <meshStandardMaterial color={C.navy} />
        </mesh>
      ))}
    </>
  );
}

function Office({ zone }: { zone: Zone }) {
  const select = useStore((s) => s.select);
  const isHovered = useStore((s) => s.hovered === `zone-${zone.id}`);
  const isSelected = useStore((s) => s.selection.kind === 'zone' && s.selection.id === zone.id);
  const handlers = useHoverable(`zone-${zone.id}`, () => select({ kind: 'zone', id: zone.id }, true));
  return (
    <group position={[zone.x, 0, zone.z]}>
      <mesh {...handlers} position={[0, zone.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[zone.w, zone.h, zone.d]} />
        <meshStandardMaterial color={C.white} emissive={C.white} emissiveIntensity={isHovered ? 0.15 : 0} />
      </mesh>
      {[1.9, 4.6].map((y) => (
        <group key={y}>
          <mesh position={[0, y, zone.d / 2 + 0.02]}>
            <planeGeometry args={[zone.w - 1.4, 1.5]} />
            <meshStandardMaterial color={C.glass} roughness={0.25} metalness={0.3} />
          </mesh>
          <mesh position={[-zone.w / 2 - 0.02, y, 0]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[zone.d - 1.4, 1.5]} />
            <meshStandardMaterial color={C.glass} roughness={0.25} metalness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, zone.h + 0.2, 0]} castShadow>
        <boxGeometry args={[zone.w + 0.4, 0.4, zone.d + 0.4]} />
        <meshStandardMaterial color={C.blue} />
      </mesh>
      <Pin y={zone.h + 3.2} active={isSelected} onSelect={handlers.onClick} hoverKey={`zone-${zone.id}`} small />
    </group>
  );
}

/** Teardrop map marker that bobs gently; brighter when its zone is selected. */
export function Pin({
  y,
  active,
  onSelect,
  hoverKey,
  small = false,
}: {
  y: number;
  active: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
  hoverKey: string;
  small?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const setHovered = useStore((s) => s.setHovered);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.6 + phase) * 0.35;
  });
  const s = small ? 0.8 : 1;
  return (
    <group
      ref={ref}
      position={[0, y, 0]}
      scale={s}
      onClick={onSelect}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(hoverKey);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
    >
      <mesh position={[0, 1.3, 0]} castShadow>
        <sphereGeometry args={[1.25, 24, 16]} />
        <meshStandardMaterial color={active ? '#1f45d6' : C.blue} emissive={C.blue} emissiveIntensity={active ? 0.35 : 0.1} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.95, 1.9, 24]} />
        <meshStandardMaterial color={active ? '#1f45d6' : C.blue} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* ground shadow dot */}
      <mesh position={[0, -y + 0.06, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.1, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

const LIGHT: Record<DockState, string> = {
  idle: '#22c55e',
  reserved: '#f59e0b',
  loading: '#2f5bea',
  unloading: '#2f5bea',
  maintenance: '#ef4444',
};

function DockDoors() {
  const states = useStore((s) =>
    s.sim.docks
      .filter((d) => d.hubId === s.hubId)
      .map((d) => d.state)
      .join(','),
  ).split(',') as DockState[];
  const select = useStore((s) => s.select);
  const hovered = useStore((s) => s.hovered);
  const selectedBay = useStore((s) => (s.selection.kind === 'dock' ? s.selection.index : -1));
  const setHovered = useStore((s) => s.setHovered);
  const z = DOCK_FACE_Z;

  return (
    <group>
      {Array.from({ length: BAY_COUNT }, (_, i) => {
        const st = states[i] ?? 'idle';
        const open = st === 'loading' || st === 'unloading';
        const hot = hovered === `dock-${i}` || selectedBay === i;
        return (
          <group
            key={i}
            position={[bayX(i), 0, z]}
            onClick={(e) => {
              e.stopPropagation();
              select({ kind: 'dock', index: i }, true);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(`dock-${i}`);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHovered(null);
              document.body.style.cursor = '';
            }}
          >
            {/* dock leveller platform */}
            <mesh position={[0, 0.6, 0.35]} castShadow receiveShadow>
              <boxGeometry args={[3.8, 1.2, 0.7]} />
              <meshStandardMaterial color="#9aa5b8" />
            </mesh>
            {/* opening (dark interior) + roller door */}
            <mesh position={[0, 3.3, 0.06]}>
              <boxGeometry args={[3.5, 4.2, 0.1]} />
              <meshStandardMaterial color="#0f1733" />
            </mesh>
            <mesh position={[0, open ? 4.9 : 3.3, 0.13]} scale={[1, open ? 0.24 : 1, 1]}>
              <boxGeometry args={[3.5, 4.2, 0.08]} />
              <meshStandardMaterial
                color={st === 'maintenance' ? '#5b6475' : C.navy}
                emissive={C.blue}
                emissiveIntensity={hot ? 0.45 : 0}
              />
            </mesh>
            {/* canopy, sign and status lamp */}
            <mesh position={[0, 5.75, 0.7]} castShadow>
              <boxGeometry args={[4.2, 0.18, 1.4]} />
              <meshStandardMaterial color={C.white} />
            </mesh>
            <mesh position={[0, 6.7, 0.12]}>
              <planeGeometry args={[1.6, 0.8]} />
              <meshBasicMaterial map={bayTexture(i + 1)} toneMapped={false} />
            </mesh>
            <mesh position={[1.45, 6.7, 0.18]}>
              <boxGeometry args={[0.45, 0.45, 0.12]} />
              <meshBasicMaterial color={LIGHT[st]} toneMapped={false} />
            </mesh>
            {/* yard bumper posts */}
            {[-2, 2].map((x) => (
              <mesh key={x} position={[x, 0.55, 0.9]}>
                <cylinderGeometry args={[0.14, 0.14, 1.1, 8]} />
                <meshStandardMaterial color="#f4b52c" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
