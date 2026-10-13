import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Crosshair, Forklift as ForkliftIcon, MapPin, Snowflake, Star, Wrench, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { clock, num, pct, rel } from '../lib/format';
import { ACTIVE_TRUCK, stockStatus } from '../sim/engine';
import { useHub, useStore } from '../sim/store';
import type { Forklift, InventoryItem, Truck } from '../sim/types';
import { ZONES } from '../scene/zones';
import { Bar, Chip, ItemIcon, batteryTone, dockLabel, forkliftLabel, stockTone, truckLabel } from './bits';
import { ShipmentStepper } from './ShipmentTracker';

export function DetailPanel() {
  const selection = useStore((s) => s.selection);
  let body: ReactNode;
  switch (selection.kind) {
    case 'truck':
      body = <TruckDetail id={selection.id} />;
      break;
    case 'dock':
      body = <DockDetail index={selection.index} />;
      break;
    case 'forklift':
      body = <ForkliftDetail id={selection.id} />;
      break;
    case 'zone':
      body = <ZoneDetail id={selection.id} />;
      break;
    case 'item':
      body = <ItemDetail sku={selection.sku} />;
      break;
    case 'shipment':
      body = <ShipmentDetail id={selection.id} />;
      break;
    default:
      body = <HubOverview />;
  }
  return <aside className="detail card">{body}</aside>;
}

function Back() {
  const hub = useHub();
  const select = useStore((s) => s.select);
  return (
    <button className="back" onClick={() => select({ kind: 'hub' }, true)}>
      <ArrowLeft size={15} /> {hub.name}
    </button>
  );
}

function Header({ eyebrow, title, sub, chips }: { eyebrow: string; title: string; sub?: ReactNode; chips?: ReactNode }) {
  return (
    <div className="detail-head">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {sub && <div className="detail-sub">{sub}</div>}
      {chips && <div className="chips">{chips}</div>}
    </div>
  );
}

function Stat({ label, value, unit, children }: { label: string; value: ReactNode; unit?: string; children?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        <b>{value}</b>
        {unit && <small>{unit}</small>}
      </span>
      {children}
    </div>
  );
}

function Missing({ what }: { what: string }) {
  return (
    <>
      <Back />
      <p className="muted">{what} has left the site and is no longer tracked here.</p>
    </>
  );
}

/* ---------------------------------------------------------------- hub */

function HubOverview() {
  const hub = useHub();
  const docks = useStore(useShallow((s) => s.sim.docks.filter((d) => d.hubId === s.hubId)));
  const items = useStore(useShallow((s) => s.sim.inventory.filter((i) => i.hubId === s.hubId)));
  const lifts = useStore(useShallow((s) => s.sim.forklifts.filter((f) => f.hubId === s.hubId)));
  const staged = useStore((s) => s.sim.trucks.filter((t) => t.hubId === s.hubId && t.status === 'scheduled').length);
  const select = useStore((s) => s.select);

  const busy = docks.filter((d) => d.state !== 'idle' && d.state !== 'maintenance').length;
  const working = lifts.filter((f) => f.status === 'active');
  const lead = working.find((f) => f.task.startsWith('Loading') || f.task.startsWith('Unloading')) ?? working[0];

  return (
    <>
      <Header
        eyebrow={`Depot · ${hub.code}`}
        title={hub.name}
        sub={
          <>
            <MapPin size={13} /> {hub.address}, {hub.city}
          </>
        }
        chips={
          <>
            <Chip tone={hub.status === 'Operational' ? 'green' : 'amber'}>{hub.status}</Chip>
            <Chip tone="grey">
              {docks.length} docks · {busy} active
            </Chip>
            <Chip tone="grey">{staged} staged</Chip>
          </>
        }
      />
      <div className="stats">
        <Stat label="Stock on hand" value={num(hub.palletsOnHand)} unit="pallets">
          <Bar value={hub.palletsOnHand / hub.capacityPallets} tone={hub.palletsOnHand / hub.capacityPallets > 0.92 ? 'amber' : 'blue'} />
        </Stat>
        <Stat label="Truck bays" value={`${busy} / ${docks.length}`} unit="in use">
          <Bar value={busy / docks.length} />
        </Stat>
        <Stat label="Outbound today" value={num(hub.outboundToday)} unit="pallets" />
        <Stat label="Putaway queue" value={num(hub.putawayQueue)} unit="pallets" />
      </div>

      <div className="section-head">
        <h3>Inventory</h3>
        <span className="muted">{items.filter((i) => stockStatus(i) !== 'In Stock').length} need attention</span>
      </div>
      <ul className="inventory">
        {items.map((i) => (
          <li key={i.sku}>
            <button className="row" onClick={() => select({ kind: 'item', sku: i.sku })}>
              <ItemIcon kind={i.kind} />
              <span className="row-main">
                <b>{i.name}</b>
                <small>
                  {i.sku} · {i.location}
                </small>
              </span>
              <span className="row-qty">{num(i.qty)}</span>
              <Chip tone={stockTone[stockStatus(i)]}>{stockStatus(i)}</Chip>
            </button>
          </li>
        ))}
      </ul>

      <div className="section-head">
        <h3>Forklift fleet</h3>
        <span className="muted">
          {working.length} of {lifts.length} working
        </span>
      </div>
      <button className="fleet" onClick={() => lead && select({ kind: 'forklift', id: lead.id }, true)} disabled={!lead}>
        <span className="fleet-icon">
          <ForkliftIcon size={18} />
        </span>
        <span className="row-main">
          <b>{lead ? lead.id : 'No forklifts working'}</b>
          <small>{lead ? lead.task : 'Fleet on standby'}</small>
        </span>
        <span className="fleet-dots" aria-label="Fleet status">
          {lifts.map((f) => (
            <i key={f.id} className={`dot dot-${forkliftLabel[f.status][1]}`} title={`${f.id} · ${forkliftLabel[f.status][0]}`} />
          ))}
        </span>
      </button>
    </>
  );
}

/* ---------------------------------------------------------------- truck */

function TruckDetail({ id }: { id: string }) {
  const t = useStore((s) => s.sim.trucks.find((x) => x.id === id));
  const sh = useStore((s) => (t?.shipmentId ? s.sim.shipments.find((x) => x.id === t.shipmentId) : undefined));
  const item = useStore((s) => (t?.restockSku ? s.sim.inventory.find((i) => i.hubId === t.hubId && i.sku === t.restockSku) : undefined));
  const now = useStore((s) => s.sim.simNow);
  const prioritise = useStore((s) => s.prioritise);
  const select = useStore((s) => s.select);
  if (!t) return <Missing what={`Truck ${id}`} />;
  const [label, tone] = truckLabel[t.status];
  const onSite = ACTIVE_TRUCK.has(t.status);

  return (
    <>
      <Back />
      <Header
        eyebrow={t.direction === 'inbound' ? 'Inbound truck' : 'Outbound truck'}
        title={t.id}
        sub={`${t.carrier} · ${t.plate}`}
        chips={
          <>
            <Chip tone={tone}>{label}</Chip>
            <Chip tone="grey">
              {t.direction === 'inbound' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />} {t.direction === 'inbound' ? 'Inbound' : 'Outbound'}
            </Chip>
            {t.priority && (
              <Chip tone="amber">
                <Star size={11} /> Priority
              </Chip>
            )}
          </>
        }
      />
      {t.status === 'docked' && (
        <div className="progress-block">
          <div className="progress-line">
            <span>
              {t.direction === 'inbound' ? 'Unloading' : 'Loading'} at Bay {t.bay! + 1}
            </span>
            <b>
              {Math.floor(t.progress * t.pallets)} / {t.pallets} pallets
            </b>
          </div>
          <Bar value={t.progress} />
        </div>
      )}
      <div className="stats">
        <Stat label={t.status === 'scheduled' ? 'ETA' : 'Arrived'} value={clock(t.eta)} unit={t.status === 'scheduled' ? rel(t.eta, now) : ''} />
        <Stat label="Bay" value={t.bay === null ? '—' : `Bay ${t.bay + 1}`} unit={t.bay === null && t.status === 'scheduled' && now > t.eta ? 'waiting' : ''} />
        <Stat label="Load" value={t.pallets} unit="pallets" />
        <Stat label="Driver" value={t.driver} />
      </div>
      {sh && (
        <>
          <div className="section-head">
            <h3>Shipment #{sh.id}</h3>
            <span className="muted">{sh.customer}</span>
          </div>
          <ShipmentStepper shipment={sh} compact />
          <p className="muted small">
            To {sh.destination} · promised by {clock(sh.promisedAt)}
          </p>
        </>
      )}
      {item && (
        <>
          <div className="section-head">
            <h3>Replenishment</h3>
          </div>
          <button className="row" onClick={() => select({ kind: 'item', sku: item.sku })}>
            <ItemIcon kind={item.kind} />
            <span className="row-main">
              <b>{item.name}</b>
              <small>
                +{num(item.reorderPoint * 3)} {item.unit} on this truck
              </small>
            </span>
            <Chip tone={stockTone[stockStatus(item)]}>{stockStatus(item)}</Chip>
          </button>
        </>
      )}
      <div className="actions">
        <button className="btn btn-primary" disabled={t.priority || !(t.status === 'scheduled' || t.status === 'arriving' || t.status === 'docked')} onClick={() => prioritise(t.id)}>
          <Star size={15} /> {t.priority ? 'Prioritized' : 'Prioritize'}
        </button>
        <button className="btn" disabled={!onSite} onClick={() => select({ kind: 'truck', id: t.id }, true)}>
          <Crosshair size={15} /> Show on map
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- dock */

function DockDetail({ index }: { index: number }) {
  const dock = useStore((s) => s.sim.docks.find((d) => d.hubId === s.hubId && d.index === index)!);
  const truck = useStore((s) => (dock.truckId ? s.sim.trucks.find((t) => t.id === dock.truckId) : undefined));
  const next = useStore((s) =>
    s.sim.trucks.filter((t) => t.hubId === s.hubId && t.status === 'scheduled').sort((a, b) => Number(b.priority) - Number(a.priority) || a.eta - b.eta)[0],
  );
  const now = useStore((s) => s.sim.simNow);
  const toggleDock = useStore((s) => s.toggleDock);
  const select = useStore((s) => s.select);
  const [label, tone] = dockLabel[dock.state];

  return (
    <>
      <Back />
      <Header eyebrow="Loading dock" title={`Bay ${index + 1}`} chips={<Chip tone={tone}>{label}</Chip>} />
      {truck ? (
        <button className="row card-row" onClick={() => select({ kind: 'truck', id: truck.id }, true)}>
          <span className="row-main">
            <b>{truck.id}</b>
            <small>
              {truck.carrier} · {truckLabel[truck.status][0]}
            </small>
          </span>
          {truck.status === 'docked' && <span className="row-qty">{pct(truck.progress)}</span>}
        </button>
      ) : (
        <p className="muted">
          {dock.state === 'maintenance' ? 'This bay is out of service and will not be assigned.' : 'No truck on this bay.'}
        </p>
      )}
      {truck?.status === 'docked' && <Bar value={truck.progress} />}
      {next && dock.state === 'idle' && (
        <p className="muted small">
          Next in queue: <b>{next.id}</b> ({next.direction}) {rel(next.eta, now)}
        </p>
      )}
      <div className="actions">
        <button className="btn" disabled={dock.state !== 'idle' && dock.state !== 'maintenance'} onClick={() => toggleDock(index)}>
          <Wrench size={15} /> {dock.state === 'maintenance' ? 'Return to service' : 'Take out of service'}
        </button>
      </div>
      {dock.state !== 'idle' && dock.state !== 'maintenance' && <p className="muted small">A bay can be taken out of service once it is free.</p>}
    </>
  );
}

/* ---------------------------------------------------------------- forklift */

function ForkliftDetail({ id }: { id: string }) {
  const f = useStore((s) => s.sim.forklifts.find((x) => x.id === id)) as Forklift | undefined;
  const setForklift = useStore((s) => s.setForklift);
  if (!f) return <Missing what={`Forklift ${id}`} />;
  const [label, tone] = forkliftLabel[f.status];
  return (
    <>
      <Back />
      <Header eyebrow="Forklift" title={f.id} sub={`Operator ${f.operator}`} chips={<Chip tone={tone}>{label}</Chip>} />
      <div className="progress-block">
        <div className="progress-line">
          <span>Battery</span>
          <b>{Math.round(f.battery)}%</b>
        </div>
        <Bar value={f.battery / 100} tone={batteryTone(f.battery)} />
      </div>
      <div className="stats">
        <Stat label="Current task" value={f.task} />
      </div>
      <div className="actions">
        {f.status === 'charging' ? (
          <button className="btn btn-primary" disabled={f.battery < 20} onClick={() => setForklift(f.id, 'active')}>
            <ForkliftIcon size={15} /> Back on duty
          </button>
        ) : (
          <button className="btn" onClick={() => setForklift(f.id, 'charging')}>
            <Zap size={15} /> Send to charge
          </button>
        )}
      </div>
      {f.status === 'charging' && f.battery < 20 && <p className="muted small">Needs at least 20% before going back on duty.</p>}
    </>
  );
}

/* ---------------------------------------------------------------- zone */

function ZoneDetail({ id }: { id: string }) {
  const hub = useHub();
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) return <Missing what="That area" />;
  const cap = Math.round(hub.capacityPallets * zone.share);
  const used = Math.round(hub.palletsOnHand * zone.share);
  return (
    <>
      <Back />
      <Header
        eyebrow={zone.kind}
        title={zone.name}
        sub={`${hub.name} · ${zone.w} × ${zone.d} m`}
        chips={
          zone.temp ? (
            <Chip tone="blue">
              <Snowflake size={11} /> {zone.temp}
            </Chip>
          ) : undefined
        }
      />
      {cap > 0 ? (
        <div className="stats">
          <Stat label="Pallets stored" value={num(used)} unit={`of ${num(cap)}`}>
            <Bar value={used / cap} />
          </Stat>
          <Stat label="Utilization" value={pct(used / cap)} />
        </div>
      ) : (
        <p className="muted">Dispatch, yard control and the driver lounge. Not a storage area.</p>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- item */

function ItemDetail({ sku }: { sku: string }) {
  const item = useStore((s) => s.sim.inventory.find((i) => i.hubId === s.hubId && i.sku === sku)) as InventoryItem | undefined;
  const truck = useStore((s) => (item?.reorderTruckId ? s.sim.trucks.find((t) => t.id === item.reorderTruckId) : undefined)) as Truck | undefined;
  const now = useStore((s) => s.sim.simNow);
  const reorder = useStore((s) => s.reorder);
  const select = useStore((s) => s.select);
  if (!item) return <Missing what="That SKU" />;
  const status = stockStatus(item);
  return (
    <>
      <Back />
      <Header
        eyebrow={`SKU · ${item.sku}`}
        title={item.name}
        sub={`Location ${item.location}`}
        chips={<Chip tone={stockTone[status]}>{status}</Chip>}
      />
      <div className="stats">
        <Stat label="On hand" value={num(item.qty)} unit={item.unit}>
          <Bar value={item.qty / (item.reorderPoint * 4)} tone={stockTone[status]} />
        </Stat>
        <Stat label="Reorder point" value={num(item.reorderPoint)} unit={item.unit} />
      </div>
      {truck ? (
        <button className="row card-row" onClick={() => select({ kind: 'truck', id: truck.id }, true)}>
          <span className="row-main">
            <b>Replenishment on {truck.id}</b>
            <small>
              {truckLabel[truck.status][0]} · {truck.status === 'scheduled' ? `due ${rel(truck.eta, now)}` : truck.bay !== null ? `Bay ${truck.bay + 1}` : ''}
            </small>
          </span>
        </button>
      ) : null}
      <div className="actions">
        <button className="btn btn-primary" disabled={!!item.reorderTruckId} onClick={() => reorder(item.sku)}>
          {item.reorderTruckId ? 'Reorder on the way' : 'Reorder now'}
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- shipment */

function ShipmentDetail({ id }: { id: string }) {
  const sh = useStore((s) => s.sim.shipments.find((x) => x.id === id));
  const select = useStore((s) => s.select);
  if (!sh) return <Missing what={`Shipment ${id}`} />;
  return (
    <>
      <Back />
      <Header
        eyebrow="Shipment"
        title={`#${sh.id}`}
        sub={`${sh.customer} · to ${sh.destination}`}
        chips={sh.onTime === false ? <Chip tone="amber">Late</Chip> : sh.onTime ? <Chip tone="green">On time</Chip> : undefined}
      />
      <ShipmentStepper shipment={sh} compact />
      <div className="stats">
        <Stat label="Pallets" value={sh.pallets} />
        <Stat label="Promised by" value={clock(sh.promisedAt)} />
      </div>
      <div className="actions">
        <button className="btn" onClick={() => select({ kind: 'truck', id: sh.truckId }, true)}>
          <Crosshair size={15} /> Truck {sh.truckId}
        </button>
      </div>
    </>
  );
}
