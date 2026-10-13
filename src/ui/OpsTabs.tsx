import { ArrowDownLeft, ArrowUpRight, Star } from 'lucide-react';
import { clock, pct, rel } from '../lib/format';
import { ACTIVE_TRUCK } from '../sim/engine';
import { useStore, type OpsTab } from '../sim/store';
import { Bar, Chip, batteryTone, dockLabel, forkliftLabel, truckLabel } from './bits';

export function OpsTabs() {
  const tab = useStore((s) => s.opsTab);
  const setTab = useStore((s) => s.setOpsTab);
  const sim = useStore((s) => s.sim);
  const hubId = useStore((s) => s.hubId);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);

  const docks = sim.docks.filter((d) => d.hubId === hubId);
  const lifts = sim.forklifts.filter((f) => f.hubId === hubId);
  const trucks = sim.trucks
    .filter((t) => t.hubId === hubId && (t.status === 'scheduled' || ACTIVE_TRUCK.has(t.status)))
    .sort((a, b) => Number(ACTIVE_TRUCK.has(b.status)) - Number(ACTIVE_TRUCK.has(a.status)) || a.eta - b.eta);
  const truckById = (id: string | null) => (id ? sim.trucks.find((t) => t.id === id) : undefined);

  const tabs: [OpsTab, string, number][] = [
    ['docks', 'Docks', docks.filter((d) => d.state !== 'idle').length],
    ['forklifts', 'Forklifts', lifts.filter((f) => f.status === 'active').length],
    ['trucks', 'Trucks', trucks.length],
  ];

  return (
    <section className="ops card" aria-label="Operations">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label} <span className="count">{n}</span>
          </button>
        ))}
      </div>
      <ul className="ops-list" role="tabpanel">
        {tab === 'docks' &&
          docks.map((d) => {
            const t = truckById(d.truckId);
            const [label, tone] = dockLabel[d.state];
            return (
              <li key={d.index}>
                <button
                  className={`ops-row${selection.kind === 'dock' && selection.index === d.index ? ' is-selected' : ''}`}
                  onClick={() => select({ kind: 'dock', index: d.index }, true)}
                >
                  <span className="ops-key">Bay {d.index + 1}</span>
                  <span className="row-main">
                    <b>{t ? t.id : '—'}</b>
                    {t?.status === 'docked' ? <Bar value={t.progress} /> : <small>{t ? t.carrier : label}</small>}
                  </span>
                  <Chip tone={tone}>{t?.status === 'docked' ? `${label} ${pct(t.progress)}` : label}</Chip>
                </button>
              </li>
            );
          })}
        {tab === 'forklifts' &&
          lifts.map((f) => {
            const [label, tone] = forkliftLabel[f.status];
            return (
              <li key={f.id}>
                <button
                  className={`ops-row${selection.kind === 'forklift' && selection.id === f.id ? ' is-selected' : ''}`}
                  onClick={() => select({ kind: 'forklift', id: f.id }, true)}
                >
                  <span className="ops-key">{f.id}</span>
                  <span className="row-main">
                    <b>{f.task}</b>
                    <small>{f.operator}</small>
                  </span>
                  <span className="battery" title={`Battery ${Math.round(f.battery)}%`}>
                    <Bar value={f.battery / 100} tone={batteryTone(f.battery)} />
                    <small>{Math.round(f.battery)}%</small>
                  </span>
                  <Chip tone={tone}>{label}</Chip>
                </button>
              </li>
            );
          })}
        {tab === 'trucks' &&
          trucks.map((t) => {
            const [label, tone] = truckLabel[t.status];
            const waiting = t.status === 'scheduled' && sim.simNow > t.eta;
            return (
              <li key={t.id}>
                <button
                  className={`ops-row${selection.kind === 'truck' && selection.id === t.id ? ' is-selected' : ''}`}
                  onClick={() => select({ kind: 'truck', id: t.id }, true)}
                >
                  <span className="ops-key">
                    {t.direction === 'inbound' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />} {t.id}
                  </span>
                  <span className="row-main">
                    <b>
                      {t.carrier} {t.priority && <Star size={11} className="star" />}
                    </b>
                    <small>{t.bay !== null ? `Bay ${t.bay + 1}` : waiting ? 'Waiting for a bay' : `ETA ${clock(t.eta)} · ${rel(t.eta, sim.simNow)}`}</small>
                  </span>
                  <Chip tone={waiting ? 'amber' : tone}>{waiting ? 'Queued' : label}</Chip>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
