import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../sim/store';
import { LANE_Z, ROAD_Z, truckPose, type Pose } from './layout';
import { C } from './textures';
import { STOP_LINE_WEST, traffic } from './trafficControl';
import { smoothNow } from './Trucks';

/*
 * Gate security. Whenever a truck pulls in or out, the west guard waves it through with a
 * light baton and the east guard steps into the westbound lane with a STOP paddle. Road
 * traffic (World.tsx) stops at its stop lines until the manoeuvre is over.
 */

const BOOTH = new THREE.Vector3(-25.5, 0, 31.2);

interface Post {
  home: THREE.Vector3;
  homeYaw: number;
  duty: THREE.Vector3;
  dutyYaw: number;
}

/** Facing +z is yaw 0; facing +x is π/2, facing −x is −π/2. */
const WEST: Post = { home: new THREE.Vector3(-25.5, 0, 33.4), homeYaw: 0, duty: new THREE.Vector3(-33, 0, 34.6), dutyYaw: -Math.PI / 2 };
const EAST: Post = {
  home: new THREE.Vector3(36, 0, 33.4),
  homeYaw: 0,
  duty: new THREE.Vector3(STOP_LINE_WEST - 6, 0, ROAD_Z - 2.4),
  dutyYaw: Math.PI / 2,
};

const pose: Pose = { x: 0, z: 0, yaw: 0, visible: false };

/** Reads the trucks once per frame and updates the shared traffic signal. */
function useTrafficSignal() {
  useFrame(() => {
    const { sim, hubId } = useStore.getState();
    const now = smoothNow();
    let hold = false;
    traffic.eastboundTrucks.length = 0;
    for (const t of sim.trucks) {
      if (t.hubId !== hubId || (t.status !== 'arriving' && t.status !== 'departing')) continue;
      hold = true;
      truckPose(t, now, pose);
      // Out on the eastbound lane (driving in, or leaving) → cars behind it keep their distance.
      if (pose.visible && pose.z > LANE_Z - 1) traffic.eastboundTrucks.push(pose.x);
    }
    traffic.hold = hold;
  });
}

export function Guards() {
  useTrafficSignal();
  return (
    <>
      <Booth />
      <Guard post={WEST} role="wave" />
      <Guard post={EAST} role="stop" />
    </>
  );
}

function Booth() {
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!beacon.current) return;
    const on = traffic.hold && Math.sin(clock.elapsedTime * 8) > 0;
    beacon.current.color.set(on ? '#ffb020' : '#7a6a4a');
  });
  return (
    <group position={BOOTH}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 2.8, 3]} />
        <meshStandardMaterial color={C.white} />
      </mesh>
      {/* windows on three sides */}
      <mesh position={[0, 1.75, 1.51]}>
        <planeGeometry args={[2.4, 1.1]} />
        <meshStandardMaterial color={C.glass} roughness={0.2} metalness={0.4} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[1.51 * side, 1.75, 0]} rotation-y={(side * Math.PI) / 2}>
          <planeGeometry args={[2.2, 1.1]} />
          <meshStandardMaterial color={C.glass} roughness={0.2} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 2.95, 0]} castShadow>
        <boxGeometry args={[3.6, 0.3, 3.6]} />
        <meshStandardMaterial color={C.blue} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <sphereGeometry args={[0.28, 12, 8]} />
        <meshBasicMaterial ref={beacon} color="#7a6a4a" toneMapped={false} />
      </mesh>
      {/* "SECURITY" band */}
      <mesh position={[0, 2.55, 1.52]}>
        <planeGeometry args={[3, 0.3]} />
        <meshBasicMaterial color={C.blue} />
      </mesh>
    </group>
  );
}

function Guard({ post, role }: { post: Post; role: 'wave' | 'stop' }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const onDuty = traffic.hold;
    target.copy(onDuty ? post.duty : post.home);

    const dx = target.x - g.position.x;
    const dz = target.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.05;
    let wantYaw = onDuty ? post.dutyYaw : post.homeYaw;
    if (walking) {
      const stepLen = Math.min(dist, delta * 5);
      g.position.x += (dx / dist) * stepLen;
      g.position.z += (dz / dist) * stepLen;
      wantYaw = Math.atan2(dx, dz);
    }
    let dy = wantYaw - g.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    g.rotation.y += dy * Math.min(1, delta * 8);

    const swing = walking ? Math.sin(t * 9) * 0.55 : 0;
    legL.current!.rotation.x = swing;
    legR.current!.rotation.x = -swing;

    const ready = onDuty && !walking;
    if (role === 'stop') {
      // Right arm straight out at the traffic with the paddle; left arm beckons the truck.
      armR.current!.rotation.set(ready ? -1.6 : -swing * 0.6, 0, 0);
      armL.current!.rotation.set(ready ? -0.3 : swing * 0.6, 0, ready ? 0.9 + Math.sin(t * 5) * 0.5 : 0);
    } else {
      // Baton arm sweeps to wave the truck through; the other hand signals "stop" to cars behind.
      armR.current!.rotation.set(ready ? -1.5 : -swing * 0.6, 0, 0);
      armL.current!.rotation.set(ready ? -0.6 : swing * 0.6, 0, ready ? 1.2 + Math.sin(t * 6) * 0.6 : 0);
    }
  });

  return (
    <group ref={root} position={post.home} scale={1.5}>
      {/* legs (pivot at the hip) */}
      <group ref={legL} position={[0.17, 0.9, 0]}>
        <Leg />
      </group>
      <group ref={legR} position={[-0.17, 0.9, 0]}>
        <Leg />
      </group>
      {/* torso + hi-vis vest */}
      <mesh position={[0, 1.33, 0]} castShadow>
        <boxGeometry args={[0.66, 0.85, 0.38]} />
        <meshStandardMaterial color="#26355f" />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <boxGeometry args={[0.7, 0.62, 0.42]} />
        <meshStandardMaterial color="#d8f43c" emissive="#b8d420" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.24, 0]}>
        <boxGeometry args={[0.72, 0.07, 0.44]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* head + cap */}
      <mesh position={[0, 1.98, 0]} castShadow>
        <sphereGeometry args={[0.21, 14, 10]} />
        <meshStandardMaterial color="#d9a882" />
      </mesh>
      <mesh position={[0, 2.14, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.12, 14]} />
        <meshStandardMaterial color="#1f2a4d" />
      </mesh>
      <mesh position={[0, 2.1, 0.2]}>
        <boxGeometry args={[0.36, 0.04, 0.2]} />
        <meshStandardMaterial color="#1f2a4d" />
      </mesh>
      {/* arms (pivot at the shoulder). Right = −x when facing +z. */}
      <group ref={armR} position={[-0.43, 1.7, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.17, 0.7, 0.2]} />
          <meshStandardMaterial color="#26355f" />
        </mesh>
        {role === 'stop' ? (
          <group position={[0, -0.95, 0]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
              <meshStandardMaterial color="#9aa5b8" />
            </mesh>
            {/* octagonal STOP paddle, face pointing along the arm */}
            <mesh position={[0, -0.45, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.05, 8]} />
              <meshBasicMaterial color="#e5352b" toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.48, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.052, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, -0.72, 0]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial color="#d9a882" />
          </mesh>
        )}
      </group>
      <group ref={armL} position={[0.43, 1.7, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.17, 0.7, 0.2]} />
          <meshStandardMaterial color="#26355f" />
        </mesh>
        {role === 'wave' && (
          <mesh position={[0, -0.95, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.7, 8]} />
            <meshBasicMaterial color="#ff8a1f" toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Leg() {
  return (
    <mesh position={[0, -0.45, 0]} castShadow>
      <boxGeometry args={[0.26, 0.9, 0.3]} />
      <meshStandardMaterial color="#1f2a4d" />
    </mesh>
  );
}
