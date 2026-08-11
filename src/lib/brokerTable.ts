/** Broker portfolio helpers: the miners assigned to a broker's referral code. */
import type { BrokerMiner } from '@/api/types';

export type { BrokerMiner };

/** Filters by miner name; a blank query keeps every row. */
export function searchBrokerMiners(miners: BrokerMiner[], query: string): BrokerMiner[] {
  const q = query.trim().toLowerCase();
  if (!q) return miners;
  return miners.filter((m) => m.name.toLowerCase().includes(q));
}

/** Combined hashrate across the portfolio, skipping rows the API left unreadable. */
export function sumBrokerHashrate(miners: BrokerMiner[]): number {
  let total = 0;
  for (const m of miners) {
    if (Number.isFinite(m.hashrate)) total += m.hashrate;
  }
  return total;
}

/** Mean broker fee, or null when no miner reports one so the card can show a dash. */
export function averageBrokerFee(miners: BrokerMiner[]): number | null {
  let total = 0;
  let seen = 0;
  for (const m of miners) {
    if (!Number.isFinite(m.broker_fee)) continue;
    total += m.broker_fee;
    seen += 1;
  }
  return seen === 0 ? null : total / seen;
}

/** `2%` / `1.5%`, matching the frames, which never draw a trailing zero. */
export function formatBrokerFee(fee: number | null | undefined): string {
  if (fee == null || !Number.isFinite(fee)) return '--';
  return `${Number(fee.toFixed(2))}%`;
}

/** Stable row key: the id when the API sends one, else the name. */
export function brokerMinerRowId(miner: BrokerMiner): string {
  return miner.id ?? miner.name;
}

/**
 * Splits a formatted reading like `2.84 TH/s` into its numeral and unit, which the
 * stat cards set at different sizes. A reading with no unit comes back unchanged.
 */
export function splitValueUnit(formatted: string): { value: string; unit?: string } {
  const at = formatted.lastIndexOf(' ');
  if (at === -1) return { value: formatted, unit: undefined };
  return { value: formatted.slice(0, at), unit: formatted.slice(at + 1) };
}
