import { Instance, Instances } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../sim/rng';
import { useStore } from '../sim/store';
import { ROAD_Z } from './layout';
import { C, windowTexture } from './textures';

/*
 * Everything around the depot: sky, countryside, mountains on the horizon, a city skyline,
 * an airport with live take-offs and landings, housing, a neighbouring industrial estate and
 * road traffic. All decorative — nothing here is clickable or driven by the simulation.
 *
 * The default camera looks from +x,+z towards -x,-z, so "ahead" is -x,-z, "right" is +x,-z
 * and "left" is -x,+z. The city sits ahead, the airport ahead-right, housing to the left.
 */

export const HORIZON = '#e6edf6';

const CITY = { x: -430, z: -485, w: 300, d: 250 };
const AIRPORT = { x0: 0, x1: 640, runwayZ: -462 };
const HOUSING = { x0: -440, x1: -192 };

export function World() {
  return (
    <>
      <SkyDome />
      <Ground />
      <Roads />
      <Mountains />
      <City />
      <Airport />
      <Housing />
      <IndustrialEstate />
      <Countryside />
      <Traffic />
    </>
  );
}

/* ---------------------------------------------------------------- sky & ground */

function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#a9c8ef') },
          horizon: { value: new THREE.Color(HORIZON) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = smoothstep(0.0, 0.45, vDir.y);
            gl_FragColor = vec4(mix(horizon, top, h), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[3600, 32, 16]} />
    </mesh>
  );
}

function Plane({ x, z, w, d, color, y = 0 }: { x: number; z: number; w: number; d: number; color: string; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Ground() {
  return (
    <>
      <Plane x={0} z={0} w={9000} d={9000} color="#d9e6cc" y={-0.08} />
      {/* industrial estate pad east of the depot */}
      <Plane x={250} z={20} w={230} d={230} color={C.ground} y={-0.03} />
      {/* city pad */}
      <Plane x={CITY.x} z={CITY.z} w={CITY.w + 30} d={CITY.d + 30} color="#e2e6ed" y={-0.03} />
      {/* airfield */}
      <Plane x={(AIRPORT.x0 + AIRPORT.x1) / 2} z={AIRPORT.runwayZ + 50} w={AIRPORT.x1 - AIRPORT.x0 + 120} d={170} color="#cfe0bf" y={-0.04} />
      {/* lake */}
      <mesh rotation-x={-Math.PI / 2} position={[-60, -0.02, -250]} scale={[1.5, 1, 1]}>
        <circleGeometry args={[55, 48]} />
        <meshStandardMaterial color="#9fc6ea" roughness={0.15} metalness={0.1} />
      </mesh>
    </>
  );
}

function Roads() {
  const road = C.road;
  return (
    <>
      {/* main road continues to the horizon both ways */}
      <Plane x={0} z={ROAD_Z} w={6000} d={12} color={road} y={0.005} />
      {/* link south to the city / airport ring road */}
      <Plane x={-170} z={-148} w={10} d={366} color={road} y={0.006} />
      <Plane x={170} z={-330} w={950} d={10} color={road} y={0.006} />
      {/* highway towards the mountains behind the city */}
      <Plane x={-170} z={-1400} w={12} d={1800} color={road} y={0.006} />
      {/* housing streets */}
      {[-400, -330, -260].map((x) => (
        <Plane key={x} x={x} z={35} w={6} d={380} color="#dfe4ec" y={0.004} />
      ))}
      {[-89, -27, 112, 174].map((z) => (
        <Plane key={z} x={(HOUSING.x0 + HOUSING.x1) / 2} z={z} w={HOUSING.x1 - HOUSING.x0 + 10} d={6} color="#dfe4ec" y={0.004} />
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- mountains */

function Mountains() {
  const peaks = useMemo(() => {
    const rnd = seeded(1234);
    const out: { x: number; z: number; r: number; h: number; rot: number; tone: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rnd() * 0.08;
      // Higher, denser range in the direction the camera faces.
      const ahead = Math.max(0, Math.cos(a - Math.atan2(-0.83, -0.55)));
      const dist = 1850 + rnd() * 400;
      const h = 160 + rnd() * 140 + ahead * 200;
      out.push({ x: Math.cos(a) * dist, z: Math.sin(a) * dist, r: h * (0.9 + rnd() * 0.4), h, rot: rnd() * Math.PI, tone: rnd() });
    }
    // A second, lower foothill row in front.
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const dist = 1450 + rnd() * 150;
      const h = 60 + rnd() * 90;
      out.push({ x: Math.cos(a) * dist, z: Math.sin(a) * dist, r: h * 1.5, h, rot: rnd() * Math.PI, tone: 0.4 + rnd() * 0.6 });
    }
    return out;
  }, []);
  const snowy = peaks.filter((p) => p.h > 300);
  const rock = ['#7d93ab', '#8aa0b7', '#8fa58c', '#7f9889'];
  return (
    <>
      <Instances limit={peaks.length}>
        <coneGeometry args={[1, 1, 7, 1]} />
        <meshStandardMaterial flatShading roughness={1} />
        {peaks.map((p, i) => (
          <Instance key={i} position={[p.x, p.h / 2, p.z]} scale={[p.r, p.h, p.r]} rotation-y={p.rot} color={rock[Math.floor(p.tone * rock.length)]} />
        ))}
      </Instances>
      <Instances limit={snowy.length || 1}>
        <coneGeometry args={[1, 1, 7, 1]} />
        <meshStandardMaterial flatShading color="#f5f8fc" roughness={0.9} />
        {snowy.map((p, i) => {
          const k = 0.3;
          return <Instance key={i} position={[p.x, p.h * (1 - k / 2) + 0.6, p.z]} scale={[p.r * k * 1.03, p.h * k, p.r * k * 1.03]} rotation-y={p.rot} />;
        })}
      </Instances>
    </>
  );
}

/* ---------------------------------------------------------------- city */

function City() {
  const { geometry, roofs } = useMemo(() => {
    const rnd = seeded(77);
    const parts: THREE.BufferGeometry[] = [];
    const roofs: { x: number; z: number; w: number; d: number; y: number }[] = [];
    const palette = ['#c9d6e8', '#dfe6f0', '#b7c7de', '#e8ecf2', '#9fb4d3', '#d4dbe6'].map((c) => new THREE.Color(c));
    const step = 24;
    for (let gx = 0; gx * step < CITY.w; gx++) {
      for (let gz = 0; gz * step < CITY.d; gz++) {
        if (rnd() < 0.12) continue; // plazas and parks
        const x = CITY.x - CITY.w / 2 + gx * step + step / 2;
        const z = CITY.z - CITY.d / 2 + gz * step + step / 2;
        const dc = Math.hypot((x - CITY.x) / (CITY.w / 2), (z - CITY.z) / (CITY.d / 2));
        const h = 12 + rnd() * 22 + Math.max(0, 1 - dc) ** 2 * (70 + rnd() * 90);
        const w = 11 + rnd() * 8;
        const d = 11 + rnd() * 8;
        const g = new THREE.BoxGeometry(w, h, d);
        // Repeat the window texture by real size; roofs sample a plain corner of it.
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let f = 0; f < 6; f++) {
          for (let v = 0; v < 4; v++) {
            const i = f * 4 + v;
            if (f === 2 || f === 3) {
              uv.setXY(i, 0.02, 0.02);
            } else {
              const across = f < 2 ? d : w;
              uv.setXY(i, uv.getX(i) * (across / 4), uv.getY(i) * (h / 3.5));
            }
          }
        }
        const col = palette[Math.floor(rnd() * palette.length)];
        const colors = new Float32Array(uv.count * 3);
        for (let i = 0; i < uv.count; i++) col.toArray(colors, i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        g.translate(x, h / 2, z);
        parts.push(g);
        if (h > 60) roofs.push({ x, z, w: w * 0.5, d: d * 0.5, y: h });
      }
    }
    return { geometry: mergeGeometries(parts), roofs };
  }, []);
  const tex = useMemo(() => windowTexture(), []);
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial map={tex} vertexColors roughness={0.6} metalness={0.1} />
      </mesh>
      {/* rooftop plant on the towers */}
      <Instances limit={roofs.length || 1}>
        <boxGeometry args={[1, 3, 1]} />
        <meshStandardMaterial color="#c2cbd8" />
        {roofs.map((r, i) => (
          <Instance key={i} position={[r.x, r.y + 1.5, r.z]} scale={[r.w, 1, r.d]} />
        ))}
      </Instances>
    </>
  );
}

/* ---------------------------------------------------------------- airport */

function Airliner({ color = C.blue }: { color?: string }) {
  return (
    <group>
      <mesh rotation-x={Math.PI / 2}>
        <capsuleGeometry args={[2, 28, 6, 12]} />
        <meshStandardMaterial color="#f7f9fc" />
      </mesh>
      <mesh position={[0, -0.6, 1]}>
        <boxGeometry args={[34, 0.5, 6]} />
        <meshStandardMaterial color="#e3e8f0" />
      </mesh>
      {[-7, 7].map((x) => (
        <mesh key={x} position={[x, -1.6, 2.5]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[1, 1, 4.5, 12]} />
          <meshStandardMaterial color="#cfd6e2" />
        </mesh>
      ))}
      <mesh position={[0, 3.6, -14]}>
        <boxGeometry args={[0.5, 6.5, 5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.5, -15]}>
        <boxGeometry args={[12, 0.4, 3]} />
        <meshStandardMaterial color="#e3e8f0" />
      </mesh>
      {/* cockpit windows */}
      <mesh position={[0, 0.9, 15.4]} rotation-x={-0.5}>
        <boxGeometry args={[2.2, 0.6, 0.6]} />
        <meshStandardMaterial color={C.glass} />
      </mesh>
    </group>
  );
}

const LOOP = 70; // seconds per take-off / landing cycle
const RUNWAY_START = AIRPORT.x0 + 30;
const LIFTOFF = RUNWAY_START + 360;

/** Position along the take-off profile at time t (s): hold, roll, rotate, climb out. */
function takeoff(t: number, out: THREE.Vector3): { pitch: number; visible: boolean } {
  const y0 = 2.6;
  if (t < 5) {
    out.set(RUNWAY_START, y0, AIRPORT.runwayZ);
    return { pitch: 0, visible: true };
  }
  if (t < 21) {
    const u = (t - 5) / 16;
    out.set(RUNWAY_START + 360 * u * u, y0, AIRPORT.runwayZ);
    return { pitch: 0, visible: true };
  }
  const s = t - 21;
  if (s > 34) return { pitch: 0, visible: false };
  const v = 45;
  const climb = 0.32 * s * s;
  out.set(LIFTOFF + v * s, y0 + climb, AIRPORT.runwayZ - s * s * 0.15);
  return { pitch: Math.atan2(0.64 * s, v), visible: true };
}

function FlyingPlane({ landing }: { landing: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const paused = useStore.getState().speed === 0;
    if (paused) return;
    let t = (clock.elapsedTime + (landing ? LOOP / 2 : 0)) % LOOP;
    // A landing is the take-off played backwards and mirrored along the runway.
    if (landing) t = Math.max(0, 55 - t);
    const { pitch, visible } = takeoff(t, pos);
    g.visible = visible;
    if (landing) pos.x = AIRPORT.x0 + AIRPORT.x1 - pos.x;
    g.position.copy(pos);
    g.rotation.set(-pitch, Math.PI / 2, 0, 'YXZ');
  });
  return (
    <group ref={ref}>
      <Airliner color={landing ? '#f2a33a' : C.blue} />
    </group>
  );
}

function Airport() {
  const cx = (AIRPORT.x0 + AIRPORT.x1) / 2;
  const len = AIRPORT.x1 - AIRPORT.x0;
  const rz = AIRPORT.runwayZ;
  return (
    <group>
      {/* runway, taxiway, apron */}
      <Plane x={cx} z={rz} w={len} d={30} color="#596274" y={0.01} />
      <Plane x={cx} z={rz + 26} w={len - 60} d={12} color="#8e98a8" y={0.01} />
      {[60, 220, 400, 580].map((x) => (
        <Plane key={x} x={x} z={rz + 13} w={10} d={14} color="#8e98a8" y={0.011} />
      ))}
      <Plane x={300} z={rz + 49} w={260} d={34} color="#c9d0db" y={0.012} />
      <Instances limit={40}>
        <planeGeometry args={[12, 0.8]} />
        <meshBasicMaterial color="#ffffff" />
        {Array.from({ length: 26 }, (_, i) => (
          <Instance key={i} position={[AIRPORT.x0 + 40 + i * 22, 0.02, rz]} rotation-x={-Math.PI / 2} />
        ))}
      </Instances>
      <Instances limit={16}>
        <planeGeometry args={[14, 1.4]} />
        <meshBasicMaterial color="#ffffff" />
        {[-10, -6, -2, 2, 6, 10].flatMap((dz) => [
          <Instance key={`a${dz}`} position={[AIRPORT.x0 + 12, 0.02, rz + dz]} rotation-x={-Math.PI / 2} />,
          <Instance key={`b${dz}`} position={[AIRPORT.x1 - 12, 0.02, rz + dz]} rotation-x={-Math.PI / 2} />,
        ])}
      </Instances>

      {/* terminal */}
      <group position={[300, 0, rz + 82]}>
        <mesh position={[0, 7, 0]}>
          <boxGeometry args={[170, 14, 24]} />
          <meshStandardMaterial color="#f4f6fa" />
        </mesh>
        <mesh position={[0, 7.5, -12.1]}>
          <planeGeometry args={[164, 8]} />
          <meshStandardMaterial color="#3a5a9a" roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh position={[0, 14.6, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[13, 13, 172, 24, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={C.blueRoof} side={THREE.DoubleSide} />
        </mesh>
        {/* jet bridges */}
        {[-50, 0, 50].map((x) => (
          <mesh key={x} position={[x, 5, -20]}>
            <boxGeometry args={[3, 3, 16]} />
            <meshStandardMaterial color="#dfe4ec" />
          </mesh>
        ))}
        {/* car park */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 22]}>
          <planeGeometry args={[150, 18]} />
          <meshStandardMaterial color="#cdd3dd" />
        </mesh>
      </group>

      {/* parked aircraft at the gates */}
      {[250, 300, 350].map((x, i) => (
        <group key={x} position={[x, 2.6, rz + 52]} rotation-y={Math.PI}>
          <Airliner color={['#2f5bea', '#e4574b', '#1b2754'][i]} />
        </group>
      ))}

      {/* control tower */}
      <group position={[460, 0, rz + 80]}>
        <mesh position={[0, 20, 0]}>
          <cylinderGeometry args={[2.6, 3.4, 40, 16]} />
          <meshStandardMaterial color="#eef1f6" />
        </mesh>
        <mesh position={[0, 42.5, 0]}>
          <cylinderGeometry args={[6.5, 5, 5, 16]} />
          <meshStandardMaterial color="#2b3a67" roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh position={[0, 45.6, 0]}>
          <cylinderGeometry args={[7, 7, 1.2, 16]} />
          <meshStandardMaterial color="#f4f6fa" />
        </mesh>
      </group>

      {/* hangars */}
      {[540, 590].map((x) => (
        <mesh key={x} position={[x, 0, rz + 62]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[14, 14, 40, 20, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#c9d2df" side={THREE.DoubleSide} />
        </mesh>
      ))}

      <FlyingPlane landing={false} />
      <FlyingPlane landing />
    </group>
  );
}

/* ---------------------------------------------------------------- housing */

function roofGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-4.4, 0);
  shape.lineTo(4.4, 0);
  shape.lineTo(0, 3.2);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false });
  g.translate(0, 0, -4.5);
  return g;
}

function Housing() {
  const houses = useMemo(() => {
    const rnd = seeded(555);
    const rows = [70, 92, 132, 154, 194, 216, 15, -7, -47, -69, -109, -131];
    const streets = [-400, -330, -260];
    const out: { x: number; z: number; rot: number; wall: number; roof: number; s: number }[] = [];
    for (const z of rows) {
      for (let x = HOUSING.x0 + 6; x < HOUSING.x1 - 4; x += 13) {
        if (streets.some((sx) => Math.abs(sx - x) < 7)) continue;
        if (rnd() < 0.1) continue;
        // Houses face the nearest street.
        const facing = [112, 174, -27, -89, 40].reduce((best, sz) => (Math.abs(sz - z) < Math.abs(best - z) ? sz : best));
        out.push({ x: x + (rnd() - 0.5) * 2, z, rot: facing > z ? 0 : Math.PI, wall: rnd(), roof: rnd(), s: 0.85 + rnd() * 0.3 });
      }
    }
    return out;
  }, []);
  const roof = useMemo(() => roofGeometry(), []);
  const walls = ['#fbf7ef', '#f3efe6', '#eef2f7', '#f6eee4'];
  const roofs = ['#c8664c', '#b5573f', '#5d6b82', '#4a5568', '#d07a52', '#3e6fb0'];
  const trees = useMemo(() => {
    const rnd = seeded(808);
    return Array.from({ length: 140 }, () => ({
      x: HOUSING.x0 + rnd() * (HOUSING.x1 - HOUSING.x0),
      z: -150 + rnd() * 380,
      s: 0.8 + rnd() * 0.6,
    })).filter((t) => Math.abs(t.z - ROAD_Z) > 12 && ![112, 174, -27, -89].some((z) => Math.abs(z - t.z) < 5));
  }, []);
  return (
    <>
      <Instances limit={houses.length}>
        <boxGeometry args={[8, 4, 9]} />
        <meshStandardMaterial />
        {houses.map((h, i) => (
          <Instance key={i} position={[h.x, 2 * h.s, h.z]} scale={h.s} rotation-y={h.rot} color={walls[Math.floor(h.wall * walls.length)]} />
        ))}
      </Instances>
      <Instances limit={houses.length} geometry={roof}>
        <meshStandardMaterial flatShading />
        {houses.map((h, i) => (
          <Instance key={i} position={[h.x, 4 * h.s, h.z]} scale={h.s} rotation-y={h.rot + Math.PI / 2} color={roofs[Math.floor(h.roof * roofs.length)]} />
        ))}
      </Instances>
      {/* front doors */}
      <Instances limit={houses.length}>
        <boxGeometry args={[1.4, 2.2, 0.2]} />
        <meshStandardMaterial color="#4b5a72" />
        {houses.map((h, i) => (
          <Instance key={i} position={[h.x, 1.1, h.z + (h.rot === 0 ? 4.6 : -4.6) * h.s]} />
        ))}
      </Instances>
      <TreeField trees={trees} />
    </>
  );
}

function TreeField({ trees }: { trees: { x: number; z: number; s: number }[] }) {
  return (
    <>
      <Instances limit={trees.length || 1}>
        <cylinderGeometry args={[0.18, 0.25, 1.6, 6]} />
        <meshStandardMaterial color={C.trunk} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 0.8 * t.s, t.z]} scale={t.s} />
        ))}
      </Instances>
      <Instances limit={trees.length || 1}>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial flatShading />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 2.6 * t.s, t.z]} scale={[t.s, t.s * 1.25, t.s]} color={i % 2 ? C.tree : C.treeDark} />
        ))}
      </Instances>
    </>
  );
}

/* ---------------------------------------------------------------- industrial estate */

const SHEDS: [x: number, z: number, w: number, d: number, h: number, wall: string, roof: string][] = [
  [185, -38, 44, 34, 10, '#e9edf3', '#98a6ba'],
  [245, -52, 40, 52, 13, '#dfe6ef', '#7d8ca3'],
  [305, -30, 38, 40, 9, '#eef1ec', '#5aa39f'],
  [190, 98, 44, 30, 9, '#e7ebf2', '#8e9bb0'],
  [255, 104, 52, 36, 12, '#f1f3f6', '#e0874f'],
  [320, 94, 34, 30, 8, '#e3e9f1', '#7d8ca3'],
];

function IndustrialEstate() {
  return (
    <>
      {SHEDS.map(([x, z, w, d, h, wall, roof], i) => {
        const facing = z < ROAD_Z ? 1 : -1; // loading doors face the road
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={wall} />
            </mesh>
            <mesh position={[0, h + 0.3, 0]} castShadow>
              <boxGeometry args={[w + 0.6, 0.6, d + 0.6]} />
              <meshStandardMaterial color={roof} />
            </mesh>
            {Array.from({ length: Math.floor(w / 8) }, (_, k) => (
              <mesh key={k} position={[-w / 2 + 5 + k * 8, 2.4, (facing * d) / 2 + facing * 0.06]}>
                <boxGeometry args={[3.4, 4, 0.1]} />
                <meshStandardMaterial color="#3f4a62" />
              </mesh>
            ))}
            {/* a parked trailer in front */}
            <mesh position={[-w / 4, 2, facing * (d / 2 + 8)]} castShadow>
              <boxGeometry args={[2.6, 3.2, 11]} />
              <meshStandardMaterial color={i % 2 ? '#f7f9fc' : '#c9d2df'} />
            </mesh>
          </group>
        );
      })}
      {/* wind turbines on the ridge east of the estate */}
      {[
        [520, -120],
        [580, -60],
        [640, 0],
      ].map(([x, z], i) => (
        <WindTurbine key={i} x={x} z={z} phase={i * 1.7} />
      ))}
    </>
  );
}

function WindTurbine({ x, z, phase }: { x: number; z: number; phase: number }) {
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (rotor.current && useStore.getState().speed !== 0) rotor.current.rotation.z += delta * 1.1;
  });
  return (
    <group position={[x, 0, z]} rotation-y={-0.6}>
      <mesh position={[0, 30, 0]}>
        <cylinderGeometry args={[0.8, 1.4, 60, 10]} />
        <meshStandardMaterial color="#f4f6fa" />
      </mesh>
      <group ref={rotor} position={[0, 60, 2]} rotation-z={phase}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation-z={(k * Math.PI * 2) / 3} position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 26, 0.3]} />
            <meshStandardMaterial color="#f4f6fa" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- countryside */

function Countryside() {
  const fields = useMemo(() => {
    const rnd = seeded(91);
    const tones = ['#e6dca4', '#cfe2ad', '#bcd998', '#e2d6a0', '#c6dda6'];
    const out: { x: number; z: number; w: number; d: number; c: string; r: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2;
      const dist = 480 + rnd() * 480;
      const x = Math.cos(a) * dist;
      const z = Math.sin(a) * dist;
      // Keep fields off the city and the airport.
      if (Math.abs(x - CITY.x) < 220 && Math.abs(z - CITY.z) < 200) continue;
      if (x > -40 && x < 700 && z < -360 && z > -560) continue;
      out.push({ x, z, w: 70 + rnd() * 90, d: 50 + rnd() * 70, c: tones[Math.floor(rnd() * tones.length)], r: rnd() * Math.PI });
    }
    return out;
  }, []);
  const trees = useMemo(() => {
    const rnd = seeded(4242);
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2;
      const dist = 420 + rnd() * 560;
      const x = Math.cos(a) * dist;
      const z = Math.sin(a) * dist;
      if (Math.abs(x - CITY.x) < 180 && Math.abs(z - CITY.z) < 150) continue;
      if (x > -40 && x < 700 && z < -360 && z > -560) continue;
      if (onRoad(x, z)) continue;
      out.push({ x, z, s: 1.2 + rnd() * 1.2 });
    }
    // Trees around the lake.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      out.push({ x: -60 + Math.cos(a) * 92, z: -250 + Math.sin(a) * 62, s: 0.9 + rnd() * 0.5 });
    }
    return out;
  }, []);
  return (
    <>
      {fields.map((f, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, f.r]} position={[f.x, -0.05, f.z]}>
          <planeGeometry args={[f.w, f.d]} />
          <meshStandardMaterial color={f.c} />
        </mesh>
      ))}
      <TreeField trees={trees} />
    </>
  );
}

/** Roughly whether a point sits on one of the long roads (keeps trees off the tarmac). */
function onRoad(x: number, z: number) {
  return Math.abs(z - ROAD_Z) < 14 || (Math.abs(x + 170) < 14 && z < 40) || (Math.abs(z + 330) < 12 && x > -310 && x < 650);
}

/* ---------------------------------------------------------------- traffic */

const CAR_COLORS = ['#ffffff', '#9aa6b8', '#2f5bea', '#e4574b', '#1b2754', '#f2c14e', '#3a3f4b', '#d9dee6'];
const CAR_COUNT = 28;
const SPAN = 2400;

/** Cars on the main road, both directions. Purely visual; they don't yield to depot trucks. */
function Traffic() {
  const body = useRef<THREE.InstancedMesh>(null);
  const cabin = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => {
    const rnd = seeded(31337);
    return Array.from({ length: CAR_COUNT }, (_, i) => ({
      x: -SPAN / 2 + rnd() * SPAN,
      dir: i % 2 ? 1 : -1,
      v: 14 + rnd() * 10,
      color: new THREE.Color(CAR_COLORS[i % CAR_COLORS.length]),
    }));
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((_, delta) => {
    if (!body.current || !cabin.current) return;
    const running = useStore.getState().speed !== 0;
    cars.forEach((c, i) => {
      if (running) {
        c.x += c.dir * c.v * Math.min(delta, 0.1);
        if (c.x > SPAN / 2) c.x -= SPAN;
        if (c.x < -SPAN / 2) c.x += SPAN;
      }
      const z = c.dir > 0 ? ROAD_Z + 2 : ROAD_Z - 2;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      body.current!.setMatrixAt(i, m.compose(p.set(c.x, 0.55, z), q, one));
      cabin.current!.setMatrixAt(i, m.compose(p.set(c.x, 1.15, z), q, one));
    });
    body.current.instanceMatrix.needsUpdate = true;
    cabin.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={(mesh) => {
          body.current = mesh;
          if (mesh) cars.forEach((c, i) => mesh.setColorAt(i, c.color));
        }}
        args={[undefined, undefined, CAR_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.7, 0.7, 3.8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[undefined, undefined, CAR_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1.5, 0.5, 2]} />
        <meshStandardMaterial color={C.glass} />
      </instancedMesh>
    </>
  );
}
