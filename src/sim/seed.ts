import { ARRIVE_DUR, BAY_COUNT, MIN, OPERATORS, SEC } from './constants';
import { spawnTruck } from './engine';
import type { Dock, Forklift, Hub, InventoryItem, ItemKind, SimState } from './types';

export const STATE_VERSION = 3;

const HUBS: Omit<Hub, 'palletsBaseline' | 'putawayAcc' | 'inboundToday' | 'outboundToday'>[] = [
  {
    id: 'riverside',
    code: 'WH-01',
    name: 'Riverside Hub',
    address: '12 Riverside Dr',
    city: 'Newark, NJ',
    status: 'Operational',
    capacityPallets: 1480,
    palletsOnHand: 1412,
    putawayQueue: 15,
    layoutSeed: 7,
  },
  {
    id: 'northgate',
    code: 'WH-02',
    name: 'Northgate DC',
    address: '480 Northgate Pkwy',
    city: 'Allentown, PA',
    status: 'Operational',
    capacityPallets: 2200,
    palletsOnHand: 1630,
    putawayQueue: 6,
    layoutSeed: 19,
  },
  {
    id: 'harbor',
    code: 'WH-03',
    name: 'Harbor Point',
    address: '77 Harbor Point Rd',
    city: 'Baltimore, MD',
    status: 'Restricted',
    capacityPallets: 1100,
    palletsOnHand: 742,
    putawayQueue: 22,
    layoutSeed: 31,
  },
];

type ItemSeed = [sku: string, name: string, kind: ItemKind, unit: string, reorder: number, location: string];
const ITEMS: ItemSeed[] = [
  ['CB-M01', 'Cardboard Box M', 'box', 'units', 400, 'A-03'],
  ['PC-220', 'Plastic Container', 'container', 'units', 180, 'B-11'],
  ['SH-104', 'Safety Helmet', 'helmet', 'units', 160, 'E-02'],
  ['PT-048', 'Packing Tape', 'tape', 'rolls', 900, 'A-07'],
  ['EP-120', 'Euro Pallet', 'pallet', 'units', 120, 'Y-01'],
  ['SW-500', 'Stretch Wrap', 'tape', 'rolls', 240, 'A-09'],
  ['DR-200', 'Steel Drum 200L', 'drum', 'units', 60, 'C-14'],
  ['FG-010', 'Foam Corner Guard', 'box', 'packs', 300, 'B-04'],
];
/** Starting quantity as a multiple of the reorder point, per hub (a few start low). */
const STOCK_MULT: Record<string, number[]> = {
  riverside: [4.8, 0.62, 1.32, 4.9, 2.6, 3.1, 1.8, 0.85],
  northgate: [3.2, 2.4, 0.7, 3.8, 1.9, 0.9, 2.2, 3.5],
  harbor: [1.6, 0.8, 2.9, 2.1, 0.75, 2.6, 0.4, 1.8],
};

const FLEET: Record<string, number> = { riverside: 6, northgate: 7, harbor: 5 };

export function createInitialState(now: number): SimState {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const hubs: Hub[] = HUBS.map((h, i) => ({
    ...h,
    palletsBaseline: h.palletsOnHand - [18, -24, 31][i],
    putawayAcc: 0,
    inboundToday: [212, 340, 96][i],
    outboundToday: [236, 410, 88][i],
  }));

  const s: SimState = {
    version: STATE_VERSION,
    simNow: now,
    dayStart: day.getTime(),
    rngSeed: 20261013,
    seq: 0,
    truckSeq: 2200,
    shipSeq: 78442,
    hubs,
    inventory: hubs.flatMap((h) =>
      ITEMS.map<InventoryItem>(([sku, name, kind, unit, reorder, location], i) => ({
        sku,
        hubId: h.id,
        name,
        kind,
        unit,
        reorderPoint: reorder,
        qty: Math.round(reorder * STOCK_MULT[h.id][i]),
        location,
        reorderTruckId: null,
      })),
    ),
    trucks: [],
    docks: hubs.flatMap((h) =>
      Array.from({ length: BAY_COUNT }, (_, index): Dock => ({
        hubId: h.id,
        index,
        state: h.id === 'harbor' && index === 5 ? 'maintenance' : 'idle',
        truckId: null,
      })),
    ),
    shipments: [],
    forklifts: hubs.flatMap((h, hi) =>
      Array.from({ length: FLEET[h.id] }, (_, i): Forklift => ({
        id: `FL-${hi + 1}${String(i + 1).padStart(2, '0')}`,
        hubId: h.id,
        operator: OPERATORS[(i + hi * 3) % OPERATORS.length],
        status: i === FLEET[h.id] - 1 ? 'charging' : i < 3 ? 'active' : 'idle',
        battery: [86, 72, 64, 91, 55, 38, 80][i] ?? 70,
        task: 'Standby',
      })),
    ),
    events: [],
    stats: {
      riverside: { deliveredTotal: 1240, deliveredOnTime: 1200 },
      northgate: { deliveredTotal: 2015, deliveredOnTime: 1941 },
      harbor: { deliveredTotal: 610, deliveredOnTime: 571 },
    },
  };

  // Put each yard mid-shift: two trucks on bays, one reversing in, some queued, some on the road.
  for (const hub of s.hubs) {
    const dockOf = (i: number) => s.docks.find((d) => d.hubId === hub.id && d.index === i)!;

    const loading = spawnTruck(s, hub.id, { direction: 'outbound', eta: now - 3 * MIN, pallets: 16 });
    dockTruck(s, loading.id, 0, 0.5);
    const unloading = spawnTruck(s, hub.id, { direction: 'inbound', eta: now - 2 * MIN, pallets: 14 });
    dockTruck(s, unloading.id, 2, 0.7);
    const arriving = spawnTruck(s, hub.id, { direction: 'outbound', eta: now + 9 * SEC, pallets: 12 });
    Object.assign(arriving, { status: 'arriving', bay: 3, phaseStart: now - 7 * SEC, phaseDur: ARRIVE_DUR });
    Object.assign(dockOf(3), { state: 'reserved', truckId: arriving.id });
    const arrivingShipment = s.shipments.find((x) => x.id === arriving.shipmentId)!;
    arrivingShipment.stage = 'packed';
    arrivingShipment.stageTimes.packed = now - 1 * MIN;

    for (const mins of [1.2, 2.5, 4]) spawnTruck(s, hub.id, { eta: now + mins * MIN });

    for (const mins of [3, 6]) {
      const t = spawnTruck(s, hub.id, { direction: 'outbound', eta: now - (20 + mins) * MIN, pallets: 10 + mins });
      const sh = s.shipments.find((x) => x.id === t.shipmentId)!;
      t.status = 'in_transit';
      Object.assign(sh, {
        stage: 'in_transit',
        stageTimes: {
          picked: now - (34 + mins) * MIN,
          packed: now - (26 + mins) * MIN,
          loading: now - (20 + mins) * MIN,
          in_transit: now - mins * MIN,
        },
        promisedAt: now + 12 * MIN,
        deliverAt: now + (mins + 1) * MIN,
      });
    }
  }
  // Seeding writes stock-consumption events; start with a clean feed.
  s.events = [];
  return s;
}

function dockTruck(s: SimState, truckId: string, bay: number, progress: number) {
  const t = s.trucks.find((x) => x.id === truckId)!;
  const dock = s.docks.find((d) => d.hubId === t.hubId && d.index === bay)!;
  t.status = 'docked';
  t.bay = bay;
  t.progress = progress;
  dock.truckId = t.id;
  dock.state = t.direction === 'inbound' ? 'unloading' : 'loading';
  const sh = t.shipmentId ? s.shipments.find((x) => x.id === t.shipmentId) : undefined;
  if (sh) {
    sh.stage = 'loading';
    sh.stageTimes = { picked: s.simNow - 22 * MIN, packed: s.simNow - 9 * MIN, loading: s.simNow - 4 * MIN };
  }
}
