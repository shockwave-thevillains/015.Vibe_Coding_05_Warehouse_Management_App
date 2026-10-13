import { Clock3, Package, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { num, pct } from '../lib/format';
import { ACTIVE_TRUCK } from '../sim/engine';
import { MIN } from '../sim/constants';
import { useHub, useStore } from '../sim/store';
import { Chip } from './bits';

const ON_TIME_TARGET = 0.95;

export function KpiCards() {
  const hub = useHub();
  const trucks = useStore((s) => s.sim.trucks);
  const now = useStore((s) => s.sim.simNow);
  const stats = useStore((s) => s.sim.stats[s.hubId]);

  const mine = trucks.filter((t) => t.hubId === hub.id);
  const onSite = mine.filter((t) => ACTIVE_TRUCK.has(t.status));
  const loading = onSite.filter((t) => t.status === 'docked').length;
  const dueSoon = mine.filter((t) => t.status === 'scheduled' && t.eta - now < 10 * MIN).length;
  const delta = hub.palletsOnHand - hub.palletsBaseline;
  const onTime = stats.deliveredTotal ? stats.deliveredOnTime / stats.deliveredTotal : 1;

  return (
    <section className="kpis" aria-label="Key figures">
      <Kpi icon={<Package size={16} />} label="Stock on hand" value={num(hub.palletsOnHand)} unit="pallets"
        chip={<Chip tone={delta >= 0 ? 'green' : 'red'}>{delta >= 0 ? '+' : '−'}{num(Math.abs(delta))}</Chip>}
        sub={`${pct(hub.palletsOnHand / hub.capacityPallets)} of ${num(hub.capacityPallets)} slots`}
      />
      <Kpi icon={<Truck size={16} />} label="Trucks on site" value={String(onSite.length)} unit={`at ${hub.code}`}
        chip={<Chip tone="blue">{dueSoon} due</Chip>}
        sub={`${loading} at bays · ${onSite.length - loading} maneuvering`}
      />
      <Kpi icon={<Clock3 size={16} />} label="On-time delivery" value={pct(onTime, 1)} unit=""
        chip={<Chip tone={onTime >= ON_TIME_TARGET ? 'green' : 'amber'}>{onTime >= ON_TIME_TARGET ? 'On target' : 'Below target'}</Chip>}
        sub={`${num(stats.deliveredOnTime)} of ${num(stats.deliveredTotal)} shipments`}
      />
    </section>
  );
}

function Kpi({ icon, label, value, unit, chip, sub }: { icon: ReactNode; label: string; value: string; unit: string; chip: ReactNode; sub: string }) {
  return (
    <div className="kpi card">
      <div className="kpi-head">
        <span className="kpi-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="kpi-value">
        <b>{value}</b>
        {unit && <small>{unit}</small>}
        {chip}
      </div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}
