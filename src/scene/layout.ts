import * as THREE from 'three';
import { BAY_COUNT } from '../sim/constants';
import type { Truck } from '../sim/types';
import { MAIN } from './zones';

export { MAIN, ZONES, type Zone } from './zones';

/* Site plan (world units ≈ metres). The main warehouse faces +z; the access road runs along x. */

export const DOCK_FACE_Z = MAIN.z + MAIN.d / 2; // 7
export const BAY_SPACING = 6.2;
export const bayX = (i: number) => (i - (BAY_COUNT - 1) / 2) * BAY_SPACING;

/** Truck model origin sits 7.3 units ahead of the trailer's rear doors. */
export const TRUCK_REAR = 7.3;
export const DOCKED_Z = DOCK_FACE_Z + 0.35 + TRUCK_REAR;

export const ROAD_Z = 40;
export const LANE_Z = 41.6;

/* -------------------------------------------------------- truck paths */

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const cache = new Map<number, { inA: THREE.CatmullRomCurve3; inB: THREE.CatmullRomCurve3; out: THREE.CatmullRomCurve3 }>();

/** Drive in along the road, swing wide, then reverse straight onto the bay; leave forward to the east. */
export function bayCurves(bay: number) {
  let c = cache.get(bay);
  if (!c) {
    const x = bayX(bay);
    c = {
      inA: new THREE.CatmullRomCurve3([v(-150, LANE_Z), v(x - 40, LANE_Z), v(x - 12, LANE_Z), v(x + 2, LANE_Z + 1.5), v(x + 11, LANE_Z + 5)]),
      inB: new THREE.CatmullRomCurve3([v(x + 11, LANE_Z + 5), v(x + 4, LANE_Z - 3), v(x, DOCKED_Z + 9), v(x, DOCKED_Z)]),
      out: new THREE.CatmullRomCurve3([v(x, DOCKED_Z), v(x, DOCKED_Z + 9), v(x + 5, LANE_Z - 2), v(x + 18, LANE_Z), v(160, LANE_Z)]),
    };
    cache.set(bay, c);
  }
  return c;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const tmp = new THREE.Vector3();

export interface Pose {
  x: number;
  z: number;
  yaw: number;
  visible: boolean;
}

/** Where a truck should be drawn at sim time `now`. */
export function truckPose(t: Truck, now: number, out: Pose): Pose {
  out.visible = false;
  if (t.bay === null) return out;
  const c = bayCurves(t.bay);
  const p = THREE.MathUtils.clamp((now - t.phaseStart) / Math.max(1, t.phaseDur), 0, 1);
  if (t.status === 'arriving') {
    const split = 0.62;
    if (p < split) {
      const u = easeInOut(p / split) * 0.98 + 0.01;
      place(c.inA, u, 1, out);
    } else {
      const u = easeInOut((p - split) / (1 - split));
      place(c.inB, Math.min(u, 0.999), -1, out);
    }
  } else if (t.status === 'docked') {
    out.x = bayX(t.bay);
    out.z = DOCKED_Z;
    out.yaw = 0;
    out.visible = true;
  } else if (t.status === 'departing') {
    place(c.out, Math.max(0.001, p * p), 1, out);
  }
  return out;
}

function place(curve: THREE.CatmullRomCurve3, u: number, dir: 1 | -1, out: Pose) {
  curve.getPointAt(u, tmp);
  out.x = tmp.x;
  out.z = tmp.z;
  curve.getTangentAt(u, tmp);
  out.yaw = Math.atan2(tmp.x * dir, tmp.z * dir);
  out.visible = true;
}

/* -------------------------------------------------------- forklifts */

/** Closed working loops in the two side yards, between pallet stacks and the building's side doors. */
export const FORKLIFT_LOOPS = [
  [v(-24, 10), v(-31, 12), v(-37, 20), v(-31, 27), v(-25, 20)],
  [v(24, 10), v(30, 13), v(33, 21), v(28, 27), v(25, 19)],
  [v(-26, 9.5), v(-38, 9.5), v(-41, 16), v(-34, 17), v(-27, 15)],
  [v(26, 9.5), v(34, 9.8), v(35, 16), v(29, 17)],
  [v(-28, 22), v(-36, 29), v(-42, 24), v(-35, 14)],
  [v(27, 24), v(34, 28), v(36, 20), v(31, 15)],
  [v(-60, 8), v(-52, 12), v(-44, 9), v(-52, 6)],
].map((pts) => new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3));

/** Parking / charging bays along the side walls, on the same side as the forklift's working loop. */
export function forkliftRest(index: number, charging: boolean) {
  const loop = FORKLIFT_LOOPS[index % FORKLIFT_LOOPS.length];
  const west = loop.points[0].x < 0;
  const k = Math.floor(index / 2);
  return v((west ? -1 : 1) * (charging ? 27.6 : 24.4), 3 - k * 2.8);
}
export const CHARGER_SLOTS = 4;

/* -------------------------------------------------------- yard pallet stacks */

export interface StackSpot {
  x: number;
  z: number;
  rot: number;
}

/** Fixed grids of stack spots; how many are filled depends on hub stock. */
export const STACK_SPOTS: StackSpot[] = (() => {
  const spots: StackSpot[] = [];
  const grid = (x0: number, z0: number, cols: number, rows: number, dx: number, dz: number) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) spots.push({ x: x0 + c * dx, z: z0 + r * dz, rot: 0 });
  };
  grid(-33, 15.5, 3, 2, 2.2, 2.4); // west yard, inside loop
  grid(-43, 27, 3, 2, 2.2, 2.2);
  grid(28.5, 15.5, 3, 2, 2.2, 2.4); // east yard
  grid(36, 28, 2, 2, 2.2, 2.2);
  grid(-58, 12, 4, 1, 2.2, 0); // by the cross-dock
  grid(-34, -5, 2, 3, 2.2, 2.2); // between the buildings
  grid(54, 22, 2, 3, 2.2, 2.2); // by the office
  return spots;
})();
