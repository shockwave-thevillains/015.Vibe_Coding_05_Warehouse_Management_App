const nf = new Intl.NumberFormat('en-US');

export const num = (n: number) => nf.format(Math.round(n));

export function clock(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "in 4 min", "2 min ago", "now". */
export function rel(t: number, now: number) {
  const m = Math.round((t - now) / 60000);
  if (m === 0) return 'now';
  if (Math.abs(m) >= 60) {
    const h = Math.round(Math.abs(m) / 60);
    return m > 0 ? `in ${h} h` : `${h} h ago`;
  }
  return m > 0 ? `in ${m} min` : `${-m} min ago`;
}

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
