import {
  ARRIVE_DUR,
  CARRIERS,
  CUSTOMERS,
  DAY,
  DEPART_DUR,
  DESTINATIONS,
  DRIVERS,
  HANDLE_PER_PALLET,
  MAX_EVENTS,
  MIN,
  PIPELINE_TARGET,
  PUTAWAY_PER_PALLET,
  RETAIN_DONE,
  SEC,
  STATES,
} from './constants';
import { nextRandom, pick, randInt } from './rng';
import type {
  EventLevel,
  Forklift,
  Hub,
  HubId,
  InventoryItem,
  Shipment,
  SimState,
  StockStatus,
  Truck,
  TruckDirection,
} from './types';

/* ------------------------------------------------------------------ helpers */

export function stockStatus(item: Pick<InventoryItem, 'qty' | 'reorderPoint'>): StockStatus {
  if (item.qty <= 0) return 'Out of Stock';
  if (item.qty <= item.reorderPoint) return 'Low Stock';
  return 'In Stock';
}

export const ACTIVE_TRUCK = new Set(['arriving', 'docked', 'departing']);

export function log(s: SimState, hubId: HubId, level: EventLevel, text: string) {
  s.events.unshift({ id: ++s.seq, t: s.simNow, hubId, level, text, read: false });
  if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
}

function clock(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function plate(s: SimState) {
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ';
  return `${pick(s, STATES)} ${randInt(s, 1, 9)}${L[randInt(s, 0, L.length - 1)]}${L[randInt(s, 0, L.length - 1)]}-${randInt(s, 100, 999)}`;
}

function hubOf(s: SimState, id: HubId): Hub {
  return s.hubs.find((h) => h.id === id)!;
}

/** Time a truck needs on the bay for its load. */
export function handleTime(pallets: number) {
  return pallets * HANDLE_PER_PALLET;
}

/* --------------------------------------------------------------- factories */

export interface SpawnOptions {
  direction?: TruckDirection;
  eta?: number;
  restockSku?: string | null;
  priority?: boolean;
  pallets?: number;
}

export function spawnTruck(s: SimState, hubId: HubId, opts: SpawnOptions = {}): Truck {
  const hub = hubOf(s, hubId);
  const fill = hub.palletsOnHand / hub.capacityPallets;
  // Bias the flow so a hub doesn't drift to empty or full over a long session.
  const outboundShare = fill > 0.92 ? 0.8 : fill < 0.7 ? 0.25 : 0.55;
  const direction = opts.direction ?? (nextRandom(s) < outboundShare ? 'outbound' : 'inbound');
  const pallets = opts.pallets ?? randInt(s, 8, 22);
  const eta = opts.eta ?? s.simNow + randInt(s, 25, 110) * SEC;
  const truck: Truck = {
    id: `TRK-${++s.truckSeq}`,
    hubId,
    carrier: direction === 'outbound' ? 'Hubline Fleet' : pick(s, CARRIERS),
    plate: plate(s),
    driver: pick(s, DRIVERS),
    direction,
    status: 'scheduled',
    eta,
    bay: null,
    phaseStart: 0,
    phaseDur: 0,
    progress: 0,
    pallets,
    shipmentId: null,
    restockSku: opts.restockSku ?? null,
    priority: opts.priority ?? false,
    doneAt: null,
    color: direction === 'outbound' ? 'blue' : nextRandom(s) < 0.6 ? 'white' : 'navy',
  };
  s.trucks.push(truck);

  if (direction === 'outbound') {
    const shipment: Shipment = {
      id: `SHP-${++s.shipSeq}`,
      hubId,
      customer: pick(s, CUSTOMERS),
      destination: pick(s, DESTINATIONS),
      pallets,
      truckId: truck.id,
      stage: 'picked',
      stageTimes: { picked: s.simNow },
      // Promise = arrive + handle + leave + a generous transit window.
      promisedAt: eta + handleTime(pallets) + DEPART_DUR + 12 * MIN,
      deliverAt: null,
      onTime: null,
    };
    truck.shipmentId = shipment.id;
    s.shipments.push(shipment);
    consumeStock(s, hubId);
  }
  return truck;
}

/** An outbound order draws down one or two SKUs. */
function consumeStock(s: SimState, hubId: HubId) {
  const items = s.inventory.filter((i) => i.hubId === hubId && i.qty > 0);
  const n = Math.min(items.length, randInt(s, 1, 2));
  for (let k = 0; k < n; k++) {
    const item = items.splice(Math.floor(nextRandom(s) * items.length), 1)[0];
    const before = stockStatus(item);
    const take = Math.max(1, Math.round(item.reorderPoint * (0.05 + nextRandom(s) * 0.18)));
    item.qty = Math.max(0, item.qty - take);
    const after = stockStatus(item);
    if (after !== before && after === 'Low Stock') {
      log(s, hubId, 'warning', `Low stock: ${item.name} (${item.qty.toLocaleString('en-US')} ${item.unit} left)`);
    }
    if (after === 'Out of Stock' && !item.reorderTruckId) {
      log(s, hubId, 'warning', `${item.name} is out of stock — auto-reorder placed`);
      placeReorder(s, item.sku, hubId, false);
    }
  }
}

/** Schedules a priority inbound truck that tops the SKU back up. Returns the truck id. */
export function placeReorder(s: SimState, sku: string, hubId: HubId, announce = true): string | null {
  const item = s.inventory.find((i) => i.sku === sku && i.hubId === hubId);
  if (!item || item.reorderTruckId) return null;
  const truck = spawnTruck(s, hubId, {
    direction: 'inbound',
    restockSku: sku,
    priority: item.qty <= 0,
    eta: s.simNow + 45 * SEC,
    pallets: randInt(s, 6, 12),
  });
  item.reorderTruckId = truck.id;
  if (announce) log(s, hubId, 'info', `Reorder placed: ${item.name} on ${truck.id}, due ${clock(truck.eta)}`);
  return truck.id;
}

/* -------------------------------------------------------------- the tick */

/** Advance the simulation by `dt` ms. Returns a new state; the input is not mutated. */
export function step(state: SimState, dt: number): SimState {
  const s = structuredClone(state);
  // Large jumps (fast-forward) are split so phase transitions aren't skipped.
  let left = dt;
  while (left > 0) {
    const chunk = Math.min(left, 2 * SEC);
    advance(s, chunk);
    left -= chunk;
  }
  return s;
}

function advance(s: SimState, dt: number) {
  s.simNow += dt;
  if (s.simNow - s.dayStart >= DAY) {
    s.dayStart += DAY * Math.floor((s.simNow - s.dayStart) / DAY);
    for (const h of s.hubs) {
      h.inboundToday = 0;
      h.outboundToday = 0;
      h.palletsBaseline = h.palletsOnHand;
    }
  }
  for (const hub of s.hubs) hubStep(s, hub, dt);

  // Housekeeping: drop trucks and shipments that finished a while ago.
  const cutoff = s.simNow - RETAIN_DONE;
  s.trucks = s.trucks.filter((t) => t.doneAt === null || t.doneAt > cutoff);
  s.shipments = s.shipments.filter(
    (sh) => sh.stage !== 'delivered' || (sh.stageTimes.delivered ?? s.simNow) > cutoff,
  );
}

function hubStep(s: SimState, hub: Hub, dt: number) {
  const now = s.simNow;
  const docks = s.docks.filter((d) => d.hubId === hub.id);
  const trucks = s.trucks.filter((t) => t.hubId === hub.id);
  const forklifts = s.forklifts.filter((f) => f.hubId === hub.id);
  const shipmentOf = (t: Truck) => (t.shipmentId ? s.shipments.find((x) => x.id === t.shipmentId) : undefined);
  const activeLifts = forklifts.filter((f) => f.status === 'active').length;

  for (const t of trucks) {
    const sh = shipmentOf(t);
    switch (t.status) {
      case 'scheduled': {
        if (sh && sh.stage === 'picked' && now >= t.eta - 40 * SEC) {
          sh.stage = 'packed';
          sh.stageTimes.packed = now;
        }
        break;
      }
      case 'arriving': {
        if (now >= t.phaseStart + t.phaseDur) {
          t.status = 'docked';
          t.progress = 0;
          const dock = docks.find((d) => d.index === t.bay)!;
          dock.state = t.direction === 'inbound' ? 'unloading' : 'loading';
          if (sh) {
            sh.stageTimes.packed ??= now;
            sh.stage = 'loading';
            sh.stageTimes.loading = now;
          }
          log(s, hub.id, 'info', `${t.id} docked at Bay ${t.bay! + 1} — ${t.direction === 'inbound' ? 'unloading' : 'loading'} ${t.pallets} pallets`);
        }
        break;
      }
      case 'docked': {
        // Without a forklift on duty the crew falls back to pallet jacks.
        const rate = (dt / handleTime(t.pallets)) * (activeLifts > 0 ? 1 : 0.35);
        const before = Math.floor(t.progress * t.pallets);
        t.progress = Math.min(1, t.progress + rate);
        const moved = Math.floor(t.progress * t.pallets) - before;
        if (t.direction === 'inbound') {
          // Received pallets count as on hand straight away; the queue tracks what still needs a rack slot.
          hub.palletsOnHand = Math.min(hub.capacityPallets, hub.palletsOnHand + moved);
          hub.putawayQueue += moved;
        } else {
          hub.palletsOnHand = Math.max(0, hub.palletsOnHand - moved);
        }

        if (t.progress >= 1) {
          t.status = 'departing';
          t.phaseStart = now;
          t.phaseDur = DEPART_DUR;
          if (t.direction === 'inbound') {
            hub.inboundToday += t.pallets;
            receiveStock(s, hub.id, t);
          } else {
            hub.outboundToday += t.pallets;
          }
        }
        break;
      }
      case 'departing': {
        if (now >= t.phaseStart + t.phaseDur) {
          const dock = docks.find((d) => d.index === t.bay);
          if (dock && dock.truckId === t.id) {
            dock.truckId = null;
            if (dock.state !== 'maintenance') dock.state = 'idle';
          }
          if (t.direction === 'outbound' && sh) {
            t.status = 'in_transit';
            sh.stage = 'in_transit';
            sh.stageTimes.in_transit = now;
            let transit = randInt(s, 4, 9) * MIN;
            // The occasional road incident — this is what keeps on-time below 100%.
            if (nextRandom(s) < 0.035) transit += randInt(s, 10, 18) * MIN;
            sh.deliverAt = now + transit;
            log(s, hub.id, 'info', `${t.id} departed for ${sh.destination} (${sh.id})`);
          } else {
            t.status = 'completed';
            t.doneAt = now;
            log(s, hub.id, 'info', `${t.id} cleared the yard`);
          }
        }
        break;
      }
      case 'in_transit': {
        if (sh?.deliverAt && now >= sh.deliverAt) {
          t.status = 'completed';
          t.doneAt = now;
          sh.stage = 'delivered';
          sh.stageTimes.delivered = now;
          sh.onTime = sh.deliverAt <= sh.promisedAt;
          const st = (s.stats[hub.id] ??= { deliveredTotal: 0, deliveredOnTime: 0 });
          st.deliveredTotal++;
          if (sh.onTime) st.deliveredOnTime++;
          log(
            s,
            hub.id,
            sh.onTime ? 'success' : 'warning',
            sh.onTime ? `${sh.id} delivered on time to ${sh.customer}` : `${sh.id} delivered late to ${sh.customer}`,
          );
        }
        break;
      }
      case 'completed':
        break;
    }
  }

  // Hand free bays to waiting trucks — priority first, then earliest ETA.
  const waiting = trucks
    .filter((t) => t.status === 'scheduled' && now >= t.eta - ARRIVE_DUR)
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.eta - b.eta);
  for (const t of waiting) {
    const dock = docks.find((d) => d.state === 'idle' && !d.truckId);
    if (!dock) break;
    dock.state = 'reserved';
    dock.truckId = t.id;
    t.bay = dock.index;
    t.status = 'arriving';
    t.phaseStart = now;
    t.phaseDur = ARRIVE_DUR;
  }

  forkliftStep(s, hub, forklifts, docks.filter((d) => d.state === 'loading' || d.state === 'unloading').length, dt);

  // Spare forklifts work the putaway queue.
  const busyOnDocks = docks.filter((d) => d.state === 'loading' || d.state === 'unloading').length;
  const workers = Math.max(0, forklifts.filter((f) => f.status === 'active').length - busyOnDocks);
  if (hub.putawayQueue > 0 && workers > 0) {
    hub.putawayAcc += (dt * workers) / PUTAWAY_PER_PALLET;
    const moved = Math.min(hub.putawayQueue, Math.floor(hub.putawayAcc));
    hub.putawayAcc -= moved;
    hub.putawayQueue -= moved;
  } else if (hub.putawayQueue === 0) {
    hub.putawayAcc = 0;
  }

  // Keep the yard busy.
  const pipeline = s.trucks.filter((t) => t.hubId === hub.id && (t.status === 'scheduled' || ACTIVE_TRUCK.has(t.status)));
  if (pipeline.length < PIPELINE_TARGET) spawnTruck(s, hub.id);
}

function receiveStock(s: SimState, hubId: HubId, t: Truck) {
  if (t.restockSku) {
    const item = s.inventory.find((i) => i.sku === t.restockSku && i.hubId === hubId);
    if (item) {
      const add = item.reorderPoint * 3;
      item.qty += add;
      item.reorderTruckId = null;
      log(s, hubId, 'success', `Restocked ${item.name}: +${add.toLocaleString('en-US')} ${item.unit}`);
    }
    return;
  }
  const items = s.inventory.filter((i) => i.hubId === hubId);
  // General inbound replenishes whatever is furthest below its reorder point.
  items.sort((a, b) => a.qty / a.reorderPoint - b.qty / b.reorderPoint);
  const item = items[0];
  // Mixed freight only tops up SKUs that are running down; well-stocked ones are left alone.
  if (item && item.qty < item.reorderPoint * 2.5) item.qty += Math.round(item.reorderPoint * (0.3 + nextRandom(s) * 0.4));
}

const AISLES = 'ABCDEFGH';

function forkliftStep(s: SimState, hub: Hub, forklifts: Forklift[], dockWork: number, dt: number) {
  const sec = dt / SEC;
  for (const f of forklifts) {
    if (f.status === 'active') f.battery -= 0.05 * sec;
    else if (f.status === 'idle') f.battery -= 0.004 * sec;
    else f.battery += 0.3 * sec;
    f.battery = Math.max(0, Math.min(100, f.battery));

    if (f.status === 'active' && f.battery < 15) {
      f.status = 'charging';
      log(s, hub.id, 'warning', `${f.id} battery at ${Math.round(f.battery)}% — sent to charge`);
    } else if (f.status === 'idle' && f.battery < 30) {
      f.status = 'charging';
    } else if (f.status === 'charging' && f.battery >= 98) {
      f.status = 'idle';
    }
  }

  const desired = Math.min(forklifts.length, dockWork + Math.ceil(hub.putawayQueue / 8));
  const active = forklifts.filter((f) => f.status === 'active');
  if (active.length < desired) {
    const candidate = forklifts
      .filter((f) => f.status === 'idle' && f.battery > 30)
      .sort((a, b) => b.battery - a.battery)[0];
    if (candidate) candidate.status = 'active';
  } else if (active.length > desired + 1) {
    active.sort((a, b) => a.battery - b.battery)[0].status = 'idle';
  }

  // Describe what each truck on a bay is getting.
  const docked = s.trucks
    .filter((t) => t.hubId === hub.id && t.status === 'docked')
    .sort((a, b) => (a.bay ?? 0) - (b.bay ?? 0));
  let k = 0;
  for (const f of forklifts) {
    if (f.status === 'charging') f.task = `Charging · ${Math.round(f.battery)}%`;
    else if (f.status === 'idle') f.task = 'Standby';
    else if (k < docked.length) {
      const t = docked[k++];
      f.task = `${t.direction === 'inbound' ? 'Unloading' : 'Loading'} ${t.id} at Bay ${t.bay! + 1}`;
    } else {
      const n = Number(f.id.replace(/\D/g, '')) || 0;
      f.task = `Putaway · Aisle ${AISLES[n % AISLES.length]}`;
    }
  }
}

/* ---------------------------------------------------------- user actions */

export function prioritiseTruck(state: SimState, id: string): SimState {
  const s = structuredClone(state);
  const t = s.trucks.find((x) => x.id === id);
  if (!t || t.priority) return state;
  t.priority = true;
  if (t.status === 'scheduled') t.eta = Math.min(t.eta, s.simNow + ARRIVE_DUR + 5 * SEC);
  log(s, t.hubId, 'info', `${t.id} marked as priority`);
  return s;
}

export function reorder(state: SimState, hubId: HubId, sku: string): SimState {
  const s = structuredClone(state);
  return placeReorder(s, sku, hubId) ? s : state;
}

export function setForklift(state: SimState, id: string, status: 'charging' | 'active'): SimState {
  const s = structuredClone(state);
  const f = s.forklifts.find((x) => x.id === id);
  if (!f) return state;
  if (status === 'active' && f.battery < 20) return state;
  f.status = status;
  log(s, f.hubId, 'info', status === 'charging' ? `${f.id} sent to charge` : `${f.id} back on duty`);
  return s;
}

export function toggleDockMaintenance(state: SimState, hubId: HubId, index: number): SimState {
  const s = structuredClone(state);
  const d = s.docks.find((x) => x.hubId === hubId && x.index === index);
  if (!d) return state;
  if (d.state === 'maintenance') {
    d.state = d.truckId ? 'reserved' : 'idle';
    log(s, hubId, 'success', `Bay ${index + 1} back in service`);
  } else if (d.state === 'idle') {
    d.state = 'maintenance';
    log(s, hubId, 'warning', `Bay ${index + 1} taken out of service`);
  } else {
    return state;
  }
  return s;
}

export function markRead(state: SimState, hubId: HubId): SimState {
  if (!state.events.some((e) => e.hubId === hubId && !e.read)) return state;
  return { ...state, events: state.events.map((e) => (e.hubId === hubId ? { ...e, read: true } : e)) };
}
