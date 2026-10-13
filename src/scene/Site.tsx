import { Instance, Instances } from '@react-three/drei';
import { useMemo } from 'react';
import { seeded } from '../sim/rng';
import { BAY_COUNT } from '../sim/constants';
import { DOCK_FACE_Z, MAIN, ROAD_Z, ZONES, bayX } from './layout';
import { C } from './textures';

/** Static ground, roads, grass, trees and parked cars. */
export function Site() {
  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 20]} receiveShadow>
        <planeGeometry args={[380, 200]} />
        <meshStandardMaterial color={C.ground} />
      </mesh>

      <Grass />

      {/* access road + yard entrance */}
      <Flat x={0} z={ROAD_Z} w={1200} d={12} color={C.road} y={0.01} />
      <Flat x={-1} z={DOCK_FACE_Z + 13} w={52} d={26} color={C.apron} y={0.02} />
      <Flat x={-50} z={14} w={26} d={18} color={C.apron} y={0.02} />
      <Flat x={-31} z={18} w={22} d={24} color={C.apron} y={0.015} />
      <Flat x={31} z={18} w={22} d={24} color={C.apron} y={0.015} />
      <Flat x={44} z={-1} w={22} d={6} color={C.road} y={0.012} />
      <Flat x={-31} z={-10} w={14} d={30} color={C.road} y={0.012} />
      <Flat x={0} z={-24} w={70} d={8} color={C.road} y={0.012} />

      <RoadMarkings />
      <Trees />
      <Cars />
    </group>
  );
}

function Flat({ x, z, w, d, color, y = 0.01 }: { x: number; z: number; w: number; d: number; color: string; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function RoadMarkings() {
  const dashes = useMemo(() => Array.from({ length: 300 }, (_, i) => -1200 + i * 8), []);
  return (
    <>
      <Instances limit={320} receiveShadow>
        <planeGeometry args={[4, 0.35]} />
        <meshStandardMaterial color={C.line} />
        {dashes.map((x) => (
          <Instance key={x} position={[x, 0.03, ROAD_Z]} rotation-x={-Math.PI / 2} />
        ))}
      </Instances>
      {/* bay guide lines */}
      <Instances limit={16}>
        <planeGeometry args={[0.18, 15]} />
        <meshStandardMaterial color={C.line} />
        {Array.from({ length: BAY_COUNT + 1 }, (_, i) => (
          <Instance key={i} position={[bayX(i) - 3.1, 0.035, DOCK_FACE_Z + 8.5]} rotation-x={-Math.PI / 2} />
        ))}
      </Instances>
      {/* edge lines */}
      <Instances limit={4}>
        <planeGeometry args={[2400, 0.25]} />
        <meshStandardMaterial color={C.line} />
        <Instance position={[0, 0.03, ROAD_Z - 5.4]} rotation-x={-Math.PI / 2} />
        <Instance position={[0, 0.03, ROAD_Z + 5.4]} rotation-x={-Math.PI / 2} />
      </Instances>
    </>
  );
}

function Grass() {
  const patches: [number, number, number, number][] = [
    [-95, 10, 50, 40],
    [100, 0, 60, 50],
    [-10, 70, 150, 40],
    [100, 70, 60, 40],
    [-110, 70, 50, 40],
    [0, -50, 120, 30],
    [-80, -40, 30, 40],
    [85, -40, 40, 40],
  ];
  return (
    <>
      {patches.map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.005, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={i % 2 ? C.grass : C.grassDark} />
        </mesh>
      ))}
    </>
  );
}

function Trees() {
  const trees = useMemo(() => {
    const rnd = seeded(42);
    const out: { x: number; z: number; s: number; dark: boolean }[] = [];
    // Rows along both road verges, skipping the yard entrance.
    for (let x = -150; x <= 150; x += 9) {
      if (x > -30 && x < 30) continue;
      out.push({ x: x + rnd() * 3, z: ROAD_Z - 8.5, s: 0.8 + rnd() * 0.5, dark: rnd() > 0.5 });
    }
    // Far verge: leave room where trucks swing out before reversing onto a bay.
    for (let x = -150; x <= 150; x += 8) {
      if (x > -45 && x < 60) continue;
      out.push({ x: x + rnd() * 3, z: ROAD_Z + 9 + rnd() * 2, s: 0.8 + rnd() * 0.5, dark: rnd() > 0.5 });
    }
    // Loose clusters on the grass.
    const clusters: [number, number, number][] = [
      [-95, 10, 9],
      [100, 0, 10],
      [0, -50, 12],
      [-80, -40, 6],
      [85, -40, 7],
      [40, 70, 8],
      [-60, 70, 8],
    ];
    for (const [cx, cz, n] of clusters)
      for (let i = 0; i < n; i++)
        out.push({ x: cx + (rnd() - 0.5) * 34, z: cz + (rnd() - 0.5) * 26, s: 0.8 + rnd() * 0.7, dark: rnd() > 0.5 });
    return out;
  }, []);
  return (
    <>
      <Instances limit={200} castShadow>
        <cylinderGeometry args={[0.18, 0.25, 1.6, 6]} />
        <meshStandardMaterial color={C.trunk} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 0.8 * t.s, t.z]} scale={t.s} />
        ))}
      </Instances>
      <Instances limit={200} castShadow>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color={C.tree} flatShading />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 2.6 * t.s, t.z]} scale={[t.s, t.s * 1.25, t.s]} color={t.dark ? C.treeDark : C.tree} />
        ))}
      </Instances>
    </>
  );
}

const CAR_COLORS = ['#ffffff', '#9aa6b8', '#2f5bea', '#ef6b5b', '#1b2754', '#f2c14e'];

function Cars() {
  const office = ZONES.find((z) => z.id === 'office')!;
  const cars = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ x: office.x - 6 + i * 2.6, z: office.z + office.d / 2 + 4, c: CAR_COLORS[i] })),
    [office],
  );
  return (
    <>
      {cars.map((car, i) => (
        <group key={i} position={[car.x, 0, car.z]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.7, 0.7, 3.6]} />
            <meshStandardMaterial color={car.c} />
          </mesh>
          <mesh position={[0, 1.05, -0.2]} castShadow>
            <boxGeometry args={[1.5, 0.5, 1.9]} />
            <meshStandardMaterial color={C.glass} />
          </mesh>
        </group>
      ))}
      {/* the back wall of the main building gets a strip of planting */}
      <mesh rotation-x={-Math.PI / 2} position={[MAIN.x, 0.012, MAIN.z - MAIN.d / 2 - 2]}>
        <planeGeometry args={[MAIN.w, 1.5]} />
        <meshStandardMaterial color={C.grassDark} />
      </mesh>
    </>
  );
}
