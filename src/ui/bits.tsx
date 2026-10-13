import { Box, Container, Cylinder, HardHat, Layers, Ribbon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DockState, ForkliftStatus, ItemKind, StockStatus, TruckStatus } from '../sim/types';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey';

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function Bar({ value, tone = 'blue' }: { value: number; tone?: Tone }) {
  return (
    <span className={`bar bar-${tone}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}

export const stockTone: Record<StockStatus, Tone> = { 'In Stock': 'green', 'Low Stock': 'amber', 'Out of Stock': 'red' };

export const dockLabel: Record<DockState, [string, Tone]> = {
  idle: ['Available', 'green'],
  reserved: ['Arriving', 'amber'],
  loading: ['Loading', 'blue'],
  unloading: ['Unloading', 'blue'],
  maintenance: ['Out of service', 'red'],
};

export const truckLabel: Record<TruckStatus, [string, Tone]> = {
  scheduled: ['Scheduled', 'grey'],
  arriving: ['Arriving', 'amber'],
  docked: ['At bay', 'blue'],
  departing: ['Departing', 'amber'],
  in_transit: ['In transit', 'blue'],
  completed: ['Completed', 'green'],
};

export const forkliftLabel: Record<ForkliftStatus, [string, Tone]> = {
  active: ['Working', 'green'],
  idle: ['Standby', 'grey'],
  charging: ['Charging', 'amber'],
};

const ITEM_ICON: Record<ItemKind, typeof Box> = {
  box: Box,
  container: Container,
  helmet: HardHat,
  tape: Ribbon,
  pallet: Layers,
  drum: Cylinder,
};

export function ItemIcon({ kind }: { kind: ItemKind }) {
  const Icon = ITEM_ICON[kind];
  return (
    <span className={`item-icon item-${kind}`}>
      <Icon size={15} strokeWidth={2} />
    </span>
  );
}

export function batteryTone(b: number): Tone {
  return b < 25 ? 'red' : b < 50 ? 'amber' : 'green';
}
