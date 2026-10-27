const ET = 'America/Toronto';

export function money(amount: number | null, ccy: string | null): string {
  if (amount == null || !ccy) return '—';
  return `${ccy} ${Math.round(amount).toLocaleString('en-CA')}`;
}

export function shortMoney(amount: number | null, ccy: string | null): string {
  if (amount == null || !ccy) return '';
  if (amount >= 1e6) return `${ccy} ${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `${ccy} ${(amount / 1e3).toFixed(0)}K`;
  return `${ccy} ${amount}`;
}

export function etTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-CA', { timeZone: ET, hour: '2-digit', minute: '2-digit', hour12: false }) + ' ET';
}

export function etDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { timeZone: ET, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function untilText(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return 'past cut-off';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `in ${m}m`;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

export function ageText(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m old`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h old`;
  return `${Math.floor(h / 24)}d old`;
}

export function agoText(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m ago` : `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function pct(v: number | null | undefined): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^[a-z]+(_[a-z]+)+$/.test(v)) return v.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  if (typeof v === 'string' && /^[a-z]+$/.test(v)) return v.charAt(0).toUpperCase() + v.slice(1);
  return String(v);
}

export const STATE_LABEL: Record<string, string> = {
  open: 'Opening', in_review: 'In review', waiting: 'Waiting', awaiting_approval: 'Awaiting approval',
  executing: 'Executing', closed: 'Closed',
};

export function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
