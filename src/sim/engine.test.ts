import { describe, expect, it } from 'vitest';
import { MIN } from './constants';
import { placeReorder, step, stockStatus, toggleDockMaintenance } from './engine';
import { createInitialState } from './seed';

const T0 = new Date('2026-10-13T09:40:00').getTime();

describe('simulation engine', () => {
  it('seeds every hub mid-shift', () => {
    const s = createInitialState(T0);
    for (const hub of s.hubs) {
      const trucks = s.trucks.filter((t) => t.hubId === hub.id);
      expect(trucks.filter((t) => t.status === 'docked')).toHaveLength(2);
      expect(trucks.filter((t) => t.status === 'arriving')).toHaveLength(1);
    }
    expect(s.trucks[0].id).toBe('TRK-2201');
    expect(s.shipments[0].id).toBe('SHP-78443');
  });

  it('does not mutate the input state', () => {
    const s = createInitialState(T0);
    const snapshot = JSON.stringify(s);
    step(s, 5000);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('keeps invariants over a long run', () => {
    let s = createInitialState(T0);
    for (let i = 0; i < 180; i++) s = step(s, 20_000); // one simulated hour
    for (const hub of s.hubs) {
      expect(hub.palletsOnHand).toBeGreaterThanOrEqual(0);
      expect(hub.palletsOnHand).toBeLessThanOrEqual(hub.capacityPallets);
      const docks = s.docks.filter((d) => d.hubId === hub.id);
      // A bay never holds two trucks, and every truck on a bay points back at it.
      for (const d of docks) {
        if (!d.truckId) continue;
        const t = s.trucks.find((x) => x.id === d.truckId)!;
        expect(t.bay).toBe(d.index);
        expect(['arriving', 'docked', 'departing']).toContain(t.status);
      }
      const onBays = s.trucks.filter((t) => t.hubId === hub.id && ['arriving', 'docked', 'departing'].includes(t.status));
      expect(new Set(onBays.map((t) => t.bay)).size).toBe(onBays.length);
    }
    for (const f of s.forklifts) {
      expect(f.battery).toBeGreaterThanOrEqual(0);
      expect(f.battery).toBeLessThanOrEqual(100);
    }
    for (const i of s.inventory) expect(i.qty).toBeGreaterThanOrEqual(0);
    // Shipments actually flow through to delivery.
    expect(s.stats.riverside.deliveredTotal).toBeGreaterThan(1240);
  });

  it('restocks an item through a reorder truck', () => {
    let s = createInitialState(T0);
    const item = s.inventory.find((i) => i.hubId === 'riverside' && i.sku === 'PC-220')!;
    expect(stockStatus(item)).toBe('Low Stock');
    const truckId = placeReorder(s, 'PC-220', 'riverside');
    expect(truckId).toBeTruthy();
    expect(placeReorder(s, 'PC-220', 'riverside')).toBeNull();
    for (let i = 0; i < 60 && s.trucks.find((t) => t.id === truckId)!.status !== 'departing'; i++) s = step(s, 10_000);
    const after = s.inventory.find((i) => i.hubId === 'riverside' && i.sku === 'PC-220')!;
    expect(after.reorderTruckId).toBeNull();
    expect(after.qty).toBeGreaterThan(item.reorderPoint);
  });

  it('never assigns a bay under maintenance', () => {
    let s = toggleDockMaintenance(createInitialState(T0), 'riverside', 5);
    for (let i = 0; i < 90; i++) {
      s = step(s, 20_000);
      const bay = s.docks.find((d) => d.hubId === 'riverside' && d.index === 5)!;
      expect(bay.state).toBe('maintenance');
      expect(bay.truckId).toBeNull();
    }
    expect(s.simNow - T0).toBe(30 * MIN);
  });
});
