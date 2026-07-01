/**
 * Minimal Blockstream/esplora shapes (only the fields we read). The address-txs
 * endpoint is a public, unauthenticated API with permissive CORS, so the browser
 * calls it directly with NO DMND session (different origin). It does disclose the
 * queried address to Blockstream, but those addresses are already public on-chain.
 * This whole path is temporary: a pool-wallet API will replace it later.
 */
export interface BlockstreamVout {
  scriptpubkey_address?: string;
  /** Output amount in satoshis. */
  value: number;
}

export interface BlockstreamTx {
  txid: string;
  status: {
    confirmed: boolean;
    /** Block timestamp in unix seconds (present once confirmed). */
    block_time?: number;
  };
  vout: BlockstreamVout[];
}

const BLOCKSTREAM_BASE =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BLOCKSTREAM_BASE ??
  'https://blockstream.info/api';

/** Start of the UTC day containing `nowMs`, in unix seconds. */
export function startOfUtcDaySec(nowMs: number): number {
  const d = new Date(nowMs);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

/**
 * Confirmed transactions for `address` whose block_time is >= `sinceSec`. Pages the
 * esplora `/txs/chain` endpoint (25 per page, newest first) and stops at the first
 * transaction older than `sinceSec` (so a single day is a page or two), passing the
 * previous page's last txid as `last_seen_txid`. `maxPages` caps the walk so a busy
 * wallet can't loop unbounded. Throws on any non-OK response so callers can fall
 * back rather than under-count.
 */
export async function fetchConfirmedTxsSince(
  address: string,
  sinceSec: number,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal; maxPages?: number } = {},
): Promise<BlockstreamTx[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxPages = opts.maxPages ?? 10;
  const collected: BlockstreamTx[] = [];
  let lastSeen: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const suffix = lastSeen ? `/${lastSeen}` : '';
    const res = await fetchImpl(
      `${BLOCKSTREAM_BASE}/address/${encodeURIComponent(address)}/txs/chain${suffix}`,
      { signal: opts.signal },
    );
    if (!res.ok) throw new Error(`Blockstream request failed (${res.status})`);
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    const txs = data as BlockstreamTx[];

    let reachedOlder = false;
    for (const tx of txs) {
      const t = tx.status?.block_time;
      // Newest-first, so the first tx older than the cutoff ends the walk.
      if (typeof t === 'number' && t < sinceSec) {
        reachedOlder = true;
        break;
      }
      collected.push(tx);
    }

    if (reachedOlder || txs.length < 25) break; // crossed the day boundary, or last page
    lastSeen = txs[txs.length - 1].txid;
    if (!lastSeen) break;
  }
  return collected;
}

/** Sum (in satoshis) the outputs across `txs` that pay any address in `addresses`. */
export function sumOutputsTo(txs: BlockstreamTx[], addresses: Set<string>): number {
  let sats = 0;
  for (const tx of txs) {
    for (const vout of tx.vout ?? []) {
      const a = vout.scriptpubkey_address;
      if (a && addresses.has(a)) sats += vout.value ?? 0;
    }
  }
  return sats;
}
