import { AlertTriangle, Bell, CheckCircle2, ChevronDown, Info, Pause, RotateCcw, Search, User, Warehouse } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clock, num, pct, rel } from '../lib/format';
import { SPEEDS, useHub, useStore, type Speed } from '../sim/store';
import type { Selection } from '../sim/types';

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function TopBar() {
  return (
    <header className="topbar card">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 32 32">
            <path d="M7 14.5 16 9l9 5.5V24H7z" fill="#fff" />
            <path d="M11 24v-6h10v6" fill="currentColor" />
          </svg>
        </span>
        <span className="brand-name">Hubline</span>
      </div>
      <SearchBox />
      <div className="topbar-right">
        <HubSelect />
        <SpeedControl />
        <LiveClock />
        <Notifications />
        <UserMenu />
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- search */

interface Hit {
  key: string;
  group: string;
  label: string;
  sub: string;
  sel: Selection;
}

function SearchBox() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useDismiss(open, () => setOpen(false));
  const input = useRef<HTMLInputElement>(null);
  const sim = useStore((s) => s.sim);
  const hubId = useStore((s) => s.hubId);
  const select = useStore((s) => s.select);
  const setHub = useStore((s) => s.setHub);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const has = (...xs: string[]) => xs.some((x) => x.toLowerCase().includes(term));
    const out: Hit[] = [];
    for (const h of sim.hubs)
      if (has(h.name, h.code, h.city)) out.push({ key: `h${h.id}`, group: 'Sites', label: h.name, sub: `${h.code} · ${h.city}`, sel: { kind: 'hub' } });
    for (const t of sim.trucks)
      if (t.hubId === hubId && t.status !== 'completed' && has(t.id, t.carrier, t.plate, t.driver))
        out.push({ key: t.id, group: 'Trucks', label: t.id, sub: `${t.carrier} · ${t.plate}`, sel: { kind: 'truck', id: t.id } });
    for (const sh of sim.shipments)
      if (sh.hubId === hubId && has(sh.id, sh.customer, sh.destination))
        out.push({ key: sh.id, group: 'Shipments', label: `#${sh.id}`, sub: `${sh.customer} → ${sh.destination}`, sel: { kind: 'shipment', id: sh.id } });
    for (const i of sim.inventory)
      if (i.hubId === hubId && has(i.sku, i.name, i.location))
        out.push({ key: `i${i.sku}`, group: 'Inventory', label: i.name, sub: `${i.sku} · ${num(i.qty)} ${i.unit} · ${i.location}`, sel: { kind: 'item', sku: i.sku } });
    for (const f of sim.forklifts)
      if (f.hubId === hubId && has(f.id, f.operator))
        out.push({ key: f.id, group: 'Forklifts', label: f.id, sub: `${f.operator} · ${f.task}`, sel: { kind: 'forklift', id: f.id } });
    return out.slice(0, 9);
  }, [q, sim, hubId]);

  // "/" jumps to search from anywhere that isn't already a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || el.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (h: Hit) => {
    if (h.group === 'Sites') setHub(h.key.slice(1));
    else select(h.sel, true);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="search" ref={ref}>
      <Search size={16} className="search-icon" aria-hidden />
      <input
        ref={input}
        value={q}
        placeholder="Search sites, trucks, SKUs, shipments…"
        aria-label="Search"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setCursor((c) => Math.min(hits.length - 1, c + 1));
          else if (e.key === 'ArrowUp') setCursor((c) => Math.max(0, c - 1));
          else if (e.key === 'Enter' && hits[cursor]) choose(hits[cursor]);
          else return;
          e.preventDefault();
        }}
      />
      <kbd className="search-kbd">/</kbd>
      {open && q.trim() && (
        <div className="menu search-menu" role="listbox">
          {hits.length === 0 && <div className="menu-empty">No matches for “{q.trim()}”</div>}
          {hits.map((h, i) => (
            <button
              key={h.key}
              role="option"
              aria-selected={i === cursor}
              className={`menu-item${i === cursor ? ' is-active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(h)}
            >
              <span className="menu-group">{h.group}</span>
              <span className="menu-label">{h.label}</span>
              <span className="menu-sub">{h.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- hubs */

function HubSelect() {
  const hub = useHub();
  const hubs = useStore((s) => s.sim.hubs);
  const setHub = useStore((s) => s.setHub);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="hub-select" ref={ref}>
      <button className="hub-button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <span className="hub-icon">
          <Warehouse size={16} />
        </span>
        <span className="hub-text">
          <b>{hub.name}</b>
          <small>
            {pct(hub.palletsOnHand / hub.capacityPallets)} full · {hub.code}
          </small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu" role="listbox">
          {hubs.map((h) => (
            <button
              key={h.id}
              role="option"
              aria-selected={h.id === hub.id}
              className={`menu-item${h.id === hub.id ? ' is-active' : ''}`}
              onClick={() => {
                setHub(h.id);
                setOpen(false);
              }}
            >
              <span className="menu-label">{h.name}</span>
              <span className="menu-sub">
                {h.code} · {h.city} · {pct(h.palletsOnHand / h.capacityPallets)} full
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- time */

function SpeedControl() {
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  return (
    <div className="segmented" role="group" aria-label="Simulation speed">
      {SPEEDS.map((s: Speed) => (
        <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)} title={s === 0 ? 'Pause' : `${s}× speed`}>
          {s === 0 ? <Pause size={13} /> : `${s}×`}
        </button>
      ))}
    </div>
  );
}

function LiveClock() {
  const now = useStore((s) => s.sim.simNow);
  const paused = useStore((s) => s.speed === 0);
  return (
    <span className={`live${paused ? ' is-paused' : ''}`}>
      <i aria-hidden />
      {paused ? 'Paused' : 'Live'} <b>{clock(now)}</b>
    </span>
  );
}

/* ---------------------------------------------------------------- events */

const LEVEL_ICON: Record<string, ReactNode> = {
  info: <Info size={15} />,
  success: <CheckCircle2 size={15} />,
  warning: <AlertTriangle size={15} />,
};

function Notifications() {
  const hubId = useStore((s) => s.hubId);
  const events = useStore((s) => s.sim.events);
  const now = useStore((s) => s.sim.simNow);
  const markRead = useStore((s) => s.markRead);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const mine = events.filter((e) => e.hubId === hubId);
  const unread = mine.filter((e) => !e.read).length;
  return (
    <div className="notif" ref={ref}>
      <button className="icon-button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="menu notif-menu">
          <div className="menu-head">
            <b>Activity</b>
            <button className="link" onClick={markRead} disabled={!unread}>
              Mark all read
            </button>
          </div>
          {mine.length === 0 && <div className="menu-empty">Nothing yet — events appear as the yard moves.</div>}
          <ul className="event-list">
            {mine.slice(0, 14).map((e) => (
              <li key={e.id} className={`event event-${e.level}${e.read ? '' : ' is-unread'}`}>
                <span className="event-icon">{LEVEL_ICON[e.level]}</span>
                <span className="event-text">{e.text}</span>
                <time>{rel(e.t, now)}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const reset = useStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="user" ref={ref}>
      <button className="user-button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar" aria-hidden>
          <User size={17} />
        </span>
        <span className="user-text">
          <b>Anonymous</b>
          <small>Operations Manager</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu user-menu">
          <div className="menu-note">Demo data runs in your browser and is saved locally.</div>
          <button
            className="menu-item menu-danger"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
        </div>
      )}
    </div>
  );
}
