/* Site areas. Kept free of three.js so the dashboard can import it without pulling in the 3D bundle. */

export const MAIN = { x: 0, z: -6, w: 44, d: 26, h: 11 };

export interface Zone {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Fraction of hub capacity this zone holds; the rest lives in the main building. */
  share: number;
  temp?: string;
}

export const ZONES: Zone[] = [
  { id: 'main', name: 'Main Warehouse', kind: 'Ambient storage', ...MAIN, share: 0.68 },
  { id: 'crossdock', name: 'Cross-Dock B', kind: 'Cross-docking', x: -50, z: -4, w: 24, d: 18, h: 8.5, share: 0.18 },
  { id: 'cold', name: 'Cold Store C', kind: 'Chilled storage', x: 44, z: -14, w: 20, d: 16, h: 9.5, share: 0.14, temp: '2–4 °C' },
  { id: 'office', name: 'Ops Office', kind: 'Offices & dispatch', x: 44, z: 10, w: 14, d: 10, h: 7, share: 0 },
];
