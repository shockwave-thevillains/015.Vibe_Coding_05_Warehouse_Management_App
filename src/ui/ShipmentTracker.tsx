import { Check, ChevronLeft, ChevronRight, PackageCheck, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clock, rel } from '../lib/format';
import { useStore } from '../sim/store';
import { SHIPMENT_STAGES, type Shipment, type ShipmentStage } from '../sim/types';
import { Chip, type Tone } from './bits';

const STAGE_LABEL: Record<ShipmentStage, string> = {
  picked: 'Picked',
  packed: 'Packed',
  loading: 'Loading',
  in_transit: 'In transit',
  delivered: 'Delivered',
};

const STAGE_TONE: Record<ShipmentStage, Tone> = {
  picked: 'grey',
  packed: 'grey',
  loading: 'blue',
  in_transit: 'blue',
  delivered: 'green',
};

/** Order the list the way a dispatcher scans it: what's on a bay first, delivered last. */
const ORDER: Record<ShipmentStage, number> = { loading: 0, packed: 1, picked: 2, in_transit: 3, delivered: 4 };

export function ShipmentStepper({ shipment, compact = false }: { shipment: Shipment; compact?: boolean }) {
  const current = SHIPMENT_STAGES.indexOf(shipment.stage);
  return (
    <ol className={`stepper${compact ? ' is-compact' : ''}`}>
      {SHIPMENT_STAGES.map((stage, i) => {
        const state = i < current || shipment.stage === 'delivered' ? 'done' : i === current ? 'current' : 'todo';
        const t = shipment.stageTimes[stage];
        return (
          <li key={stage} className={`step step-${state}`}>
            <span className="step-dot">{state === 'done' ? <Check size={12} strokeWidth={3} /> : null}</span>
            <span className="step-label">{STAGE_LABEL[stage]}</span>
            {!compact && <span className="step-time">{t ? clock(t) : stage === 'delivered' && shipment.deliverAt ? `ETA ${clock(shipment.deliverAt)}` : '—'}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ShipmentTracker() {
  const hubId = useStore((s) => s.hubId);
  const all = useStore((s) => s.sim.shipments);
  const trucks = useStore((s) => s.sim.trucks);
  const now = useStore((s) => s.sim.simNow);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      all
        .filter((s) => s.hubId === hubId)
        .sort((a, b) => ORDER[a.stage] - ORDER[b.stage] || (b.stageTimes[b.stage] ?? 0) - (a.stageTimes[a.stage] ?? 0)),
    [all, hubId],
  );

  // Follow the map: a selected shipment or the selected truck's shipment wins.
  const fromSelection =
    selection.kind === 'shipment'
      ? selection.id
      : selection.kind === 'truck'
        ? trucks.find((t) => t.id === selection.id)?.shipmentId ?? null
        : null;
  const activeId = fromSelection ?? pickedId;
  const index = Math.max(0, list.findIndex((s) => s.id === activeId));
  const sh = list[index];

  const go = (d: number) => {
    const next = list[(index + d + list.length) % list.length];
    if (!next) return;
    setPickedId(next.id);
    if (fromSelection) select({ kind: 'hub' });
  };

  const truck = sh ? trucks.find((t) => t.id === sh.truckId) : undefined;
  const active = list.filter((s) => s.stage !== 'delivered').length;

  return (
    <section className="tracker card" aria-label="Shipment tracking">
      <div className="tracker-head">
        <h3>
          <Truck size={16} /> Shipment Tracking
        </h3>
        <span className="muted">{active} active</span>
        <div className="pager">
          <button className="icon-button sm" onClick={() => go(-1)} aria-label="Previous shipment" disabled={list.length < 2}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted">
            {list.length ? index + 1 : 0}/{list.length}
          </span>
          <button className="icon-button sm" onClick={() => go(1)} aria-label="Next shipment" disabled={list.length < 2}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {sh ? (
        <div className="tracker-body">
          <ShipmentStepper shipment={sh} />
          <button className="shipment-card" onClick={() => select({ kind: 'truck', id: sh.truckId }, true)}>
            <span className="shipment-icon">
              <PackageCheck size={18} />
            </span>
            <span className="row-main">
              <b>#{sh.id}</b>
              <small>To {sh.destination}</small>
              <small>
                {sh.truckId}
                {truck?.bay != null && (truck.status === 'docked' || truck.status === 'arriving') ? ` · Bay ${truck.bay + 1}` : ''} · {sh.pallets} pallets
              </small>
            </span>
            <span className="shipment-side">
              <Chip tone={sh.onTime === false ? 'amber' : STAGE_TONE[sh.stage]}>{sh.onTime === false ? 'Late' : STAGE_LABEL[sh.stage]}</Chip>
              <small className="muted">
                {sh.stage === 'delivered'
                  ? `Delivered ${rel(sh.stageTimes.delivered!, now)}`
                  : sh.deliverAt
                    ? `ETA ${clock(sh.deliverAt)}`
                    : `Due ${clock(sh.promisedAt)}`}
              </small>
            </span>
          </button>
        </div>
      ) : (
        <p className="muted">No shipments at this site yet.</p>
      )}
    </section>
  );
}
