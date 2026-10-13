import { Instance, Instances } from '@react-three/drei';
import { useMemo } from 'react';
import { seeded } from '../sim/rng';
import { useStore } from '../sim/store';
import { STACK_SPOTS } from './layout';
import { C } from './textures';

/** Pallet stacks in the yard. How full the yard looks follows the hub's stock level. */
export function Pallets() {
  const seed = useStore((s) => s.sim.hubs.find((h) => h.id === s.hubId)!.layoutSeed);
  // Quantised so the instances only rebuild when the picture would visibly change.
  const fill = useStore((s) => {
    const h = s.sim.hubs.find((x) => x.id === s.hubId)!;
    return Math.round((h.palletsOnHand / h.capacityPallets) * 20) / 20;
  });

  const { pallets, boxes } = useMemo(() => {
    const rnd = seeded(seed);
    const order = STACK_SPOTS.map((spot, i) => ({ spot, i, r: rnd() })).sort((a, b) => a.r - b.r);
    const count = Math.round(STACK_SPOTS.length * Math.min(1, 0.25 + fill * 0.8));
    const pallets: { x: number; z: number; y: number }[] = [];
    const boxes: { x: number; z: number; y: number; dark: boolean; s: number }[] = [];
    for (const { spot } of order.slice(0, count)) {
      const layers = 1 + Math.floor(rnd() * 3);
      for (let l = 0; l < layers; l++) {
        const base = l * 1.05;
        pallets.push({ x: spot.x, z: spot.z, y: base + 0.08 });
        for (const [ox, oz] of [
          [-0.47, -0.47],
          [0.47, -0.47],
          [-0.47, 0.47],
          [0.47, 0.47],
        ]) {
          if (l === layers - 1 && rnd() < 0.25) continue;
          boxes.push({ x: spot.x + ox, z: spot.z + oz, y: base + 0.56, dark: rnd() < 0.35, s: 0.9 + rnd() * 0.08 });
        }
      }
    }
    return { pallets, boxes };
  }, [seed, fill]);

  return (
    <>
      <Instances limit={200} castShadow receiveShadow>
        <boxGeometry args={[2, 0.16, 2]} />
        <meshStandardMaterial color={C.pallet} />
        {pallets.map((p, i) => (
          <Instance key={i} position={[p.x, p.y, p.z]} />
        ))}
      </Instances>
      <Instances limit={800} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.8, 0.92]} />
        <meshStandardMaterial color={C.box} />
        {boxes.map((b, i) => (
          <Instance key={i} position={[b.x, b.y, b.z]} scale={b.s} color={b.dark ? C.boxDark : C.box} />
        ))}
      </Instances>
      {/* packing tape stripes on top of each box */}
      <Instances limit={800}>
        <boxGeometry args={[0.94, 0.81, 0.12]} />
        <meshStandardMaterial color="#efd9b4" />
        {boxes.map((b, i) => (
          <Instance key={i} position={[b.x, b.y, b.z]} scale={b.s} />
        ))}
      </Instances>
    </>
  );
}
