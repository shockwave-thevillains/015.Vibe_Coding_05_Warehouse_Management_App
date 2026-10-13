import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../sim/store';
import { Buildings } from './Buildings';
import { CameraRig, HOME_OFFSET, HOME_TARGET, INTRO, PANORAMA } from './CameraRig';
import { Forklifts } from './Forklifts';
import { Guards } from './Guards';
import { Pallets } from './Pallets';
import { Site } from './Site';
import { Trucks } from './Trucks';
import { HORIZON, World } from './World';
import { LabelProjector, TruckLabels } from './TruckLabels';

function useCompact() {
  const query = '(max-width: 900px)';
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

/**
 * On desktop the right-hand panel covers part of the canvas. Shift the projection so the
 * yard is centred in the area that is actually visible (no shift while panels are hidden).
 */
function ViewOffset({ compact }: { compact: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const shift = useRef(-1);
  // Eased every frame so hiding / showing the panels slides the view instead of jumping.
  useFrame((_, delta) => {
    const side = document.querySelector('.side');
    const hidden = useStore.getState().uiHidden;
    const want = compact || hidden || !side ? 0 : side.getBoundingClientRect().width + 32;
    const next = shift.current < 0 ? want : THREE.MathUtils.damp(shift.current, want, 6, delta);
    const aspect = (size.width + next) / size.height;
    if (Math.abs(next - shift.current) < 0.25 && Math.abs(camera.aspect - aspect) < 1e-4) return;
    shift.current = Math.abs(next - want) < 0.25 ? want : next;
    if (shift.current > 0) {
      camera.setViewOffset(size.width + shift.current, size.height, shift.current, 0, size.width, size.height);
    } else {
      camera.clearViewOffset();
    }
    camera.aspect = (size.width + shift.current) / size.height;
    camera.updateProjectionMatrix();
  });
  return null;
}

export default function Scene() {
  const compact = useCompact();
  const select = useStore((s) => s.select);
  const cam = INTRO ? PANORAMA.pos.clone() : HOME_TARGET.clone().add(HOME_OFFSET.clone().multiplyScalar(compact ? 1.1 : 1));

  return (
    <>
    <Canvas
      className="scene-canvas"
      shadows={compact ? false : 'percentage'}
      dpr={compact ? [1, 1.5] : [1, 2]}
      camera={{ position: cam.toArray(), fov: 30, near: 1, far: 8000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      onPointerMissed={() => select({ kind: 'hub' })}
    >
      <color attach="background" args={[HORIZON]} />
      <fog attach="fog" args={[HORIZON, 800, 3400]} />
      <hemisphereLight args={['#ffffff', '#c9d3e3', 1.6]} />
      <directionalLight
        position={[60, 110, 50]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={300}
        shadow-bias={-0.0004}
      />
      <World />
      <Site />
      <Buildings />
      <Pallets />
      <Trucks />
      <Forklifts />
      <Guards />
      <CameraRig compact={compact} />
      <ViewOffset compact={compact} />
      <LabelProjector />
    </Canvas>
    <TruckLabels />
    </>
  );
}
