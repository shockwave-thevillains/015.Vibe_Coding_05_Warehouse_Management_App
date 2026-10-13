import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../sim/store';
import { DOCKED_Z, ZONES, bayX, truckPose, type Pose } from './layout';
import { forkliftPositions } from './Forklifts';
import { smoothNow } from './Trucks';

export const HOME_TARGET = new THREE.Vector3(0, 0, 8);
/** Camera offset from its target for the default three-quarter view. */
export const HOME_OFFSET = new THREE.Vector3(74, 90, 112);

const pose: Pose = { x: 0, z: 0, yaw: 0, visible: false };

/** World point the current selection lives at, or null for the default overview. */
function selectionPoint(): THREE.Vector3 | null {
  const { selection, sim } = useStore.getState();
  switch (selection.kind) {
    case 'truck': {
      const t = sim.trucks.find((x) => x.id === selection.id);
      if (!t) return null;
      truckPose(t, smoothNow(), pose);
      return pose.visible ? new THREE.Vector3(pose.x, 0, pose.z) : null;
    }
    case 'dock':
      return new THREE.Vector3(bayX(selection.index), 0, DOCKED_Z - 4);
    case 'forklift': {
      const p = forkliftPositions.get(selection.id);
      return p ? p.clone() : null;
    }
    case 'zone': {
      const z = ZONES.find((x) => x.id === selection.id);
      return z ? new THREE.Vector3(z.x, 0, z.z) : null;
    }
    default:
      return null;
  }
}

export function CameraRig({ compact }: { compact: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const focusNonce = useStore((s) => s.focusNonce);
  const zoomRequest = useStore((s) => s.zoomRequest);
  const flight = useRef<{ target: THREE.Vector3; pos: THREE.Vector3 } | null>(null);
  const offsetScale = compact ? 1.1 : 1;

  // Fly to the selection (or back home) when asked.
  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    const p = selectionPoint();
    if (p) {
      const dir = camera.position.clone().sub(ctl.target).normalize();
      const dist = Math.min(camera.position.distanceTo(ctl.target), 85 * offsetScale);
      flight.current = { target: p, pos: p.clone().add(dir.multiplyScalar(dist)) };
    } else {
      flight.current = { target: HOME_TARGET.clone(), pos: HOME_TARGET.clone().add(HOME_OFFSET.clone().multiplyScalar(offsetScale)) };
    }
  }, [focusNonce, camera, offsetScale]);

  useEffect(() => {
    const ctl = controls.current;
    if (!ctl || zoomRequest.nonce === 0) return;
    if (zoomRequest.dir === 0) {
      flight.current = { target: HOME_TARGET.clone(), pos: HOME_TARGET.clone().add(HOME_OFFSET.clone().multiplyScalar(offsetScale)) };
      return;
    }
    const offset = camera.position.clone().sub(ctl.target);
    const len = THREE.MathUtils.clamp(offset.length() * (zoomRequest.dir > 0 ? 0.75 : 1.33), ctl.minDistance, ctl.maxDistance);
    flight.current = { target: ctl.target.clone(), pos: ctl.target.clone().add(offset.setLength(len)) };
  }, [zoomRequest, camera, offsetScale]);

  useFrame((_, delta) => {
    const ctl = controls.current;
    const f = flight.current;
    if (!ctl || !f) return;
    const k = 1 - Math.exp(-delta * 4.5);
    ctl.target.lerp(f.target, k);
    camera.position.lerp(f.pos, k);
    ctl.update();
    if (camera.position.distanceTo(f.pos) < 0.05 && ctl.target.distanceTo(f.target) < 0.05) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={HOME_TARGET}
      enableDamping
      dampingFactor={0.08}
      minDistance={25}
      maxDistance={260}
      minPolarAngle={0.25}
      maxPolarAngle={1.25}
      // A hand on the controls cancels any flight in progress.
      onStart={() => (flight.current = null)}
    />
  );
}
