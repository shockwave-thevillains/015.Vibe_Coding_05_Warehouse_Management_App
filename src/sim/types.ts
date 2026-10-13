export type HubId = string;

export interface Hub {
  id: HubId;
  code: string;
  name: string;
  address: string;
  city: string;
  status: 'Operational' | 'Restricted';
  /** Pallet positions available across the site. */
  capacityPallets: number;
  /** Pallets currently stored on site. */
  palletsOnHand: number;
  /** palletsOnHand at the start of the simulated day, used for the delta chip. */
  palletsBaseline: number;
  putawayQueue: number;
  /** Fractional pallet progress of the forklifts working the putaway queue. */
  putawayAcc: number;
  inboundToday: number;
  outboundToday: number;
  /** Seed used for the decorative yard layout (pallet stacks, trees). */
  layoutSeed: number;
}

export type ItemKind = 'box' | 'container' | 'helmet' | 'tape' | 'pallet' | 'drum';

export interface InventoryItem {
  sku: string;
  hubId: HubId;
  name: string;
  kind: ItemKind;
  qty: number;
  unit: string;
  reorderPoint: number;
  location: string;
  /** Set when a replenishment truck is already on its way, so we don't double-order. */
  reorderTruckId?: string | null;
}

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export type TruckDirection = 'inbound' | 'outbound';
export type TruckStatus = 'scheduled' | 'arriving' | 'docked' | 'departing' | 'in_transit' | 'completed';

export interface Truck {
  id: string;
  hubId: HubId;
  carrier: string;
  plate: string;
  driver: string;
  direction: TruckDirection;
  status: TruckStatus;
  /** Planned arrival at the hub (sim ms). */
  eta: number;
  /** Bay index (0-based) once a dock is assigned. */
  bay: number | null;
  /** Start / duration of the current movement phase (arriving, departing). */
  phaseStart: number;
  phaseDur: number;
  /** Loading / unloading progress while docked, 0..1. */
  progress: number;
  pallets: number;
  shipmentId: string | null;
  /** SKU being replenished by an inbound truck, if any. */
  restockSku: string | null;
  priority: boolean;
  /** When the truck reached its final state, for cleanup. */
  doneAt: number | null;
  color: TruckColor;
}

export type TruckColor = 'blue' | 'white' | 'navy';

export type DockState = 'idle' | 'reserved' | 'loading' | 'unloading' | 'maintenance';

export interface Dock {
  hubId: HubId;
  index: number;
  state: DockState;
  truckId: string | null;
}

export const SHIPMENT_STAGES = ['picked', 'packed', 'loading', 'in_transit', 'delivered'] as const;
export type ShipmentStage = (typeof SHIPMENT_STAGES)[number];

export interface Shipment {
  id: string;
  hubId: HubId;
  customer: string;
  destination: string;
  pallets: number;
  truckId: string;
  stage: ShipmentStage;
  stageTimes: Partial<Record<ShipmentStage, number>>;
  /** Promised delivery time; delivering after this counts as late. */
  promisedAt: number;
  /** Planned delivery time once in transit. */
  deliverAt: number | null;
  onTime: boolean | null;
}

export type ForkliftStatus = 'active' | 'idle' | 'charging';

export interface Forklift {
  id: string;
  hubId: HubId;
  operator: string;
  status: ForkliftStatus;
  battery: number;
  task: string;
}

export type EventLevel = 'info' | 'success' | 'warning';

export interface SimEvent {
  id: number;
  t: number;
  hubId: HubId;
  level: EventLevel;
  text: string;
  read: boolean;
}

export interface Stats {
  deliveredTotal: number;
  deliveredOnTime: number;
}

export type Selection =
  | { kind: 'hub' }
  | { kind: 'truck'; id: string }
  | { kind: 'dock'; index: number }
  | { kind: 'forklift'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'item'; sku: string }
  | { kind: 'shipment'; id: string };

export interface SimState {
  version: number;
  simNow: number;
  /** Sim day start (ms) — counters reset when the sim crosses midnight. */
  dayStart: number;
  rngSeed: number;
  /** Event id counter. */
  seq: number;
  truckSeq: number;
  shipSeq: number;
  hubs: Hub[];
  inventory: InventoryItem[];
  trucks: Truck[];
  docks: Dock[];
  shipments: Shipment[];
  forklifts: Forklift[];
  events: SimEvent[];
  stats: Record<HubId, Stats>;
}
