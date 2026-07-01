import type { Worker } from '@/api/types';

export interface WorkerStats {
  activeCount: number;
  offlineCount: number;
  totalCount: number;
  /** Combined rejected/total share fraction (0..1), or null when there are no shares yet. */
  rejectionRate: number | null;
}

/**
 * Derives the home's worker stat cards (Active / Offline / Rejection) from the
 * worker roster. Active vs offline is `is_connected`; the rejection rate
 * combines PPLNS and FPPS shares. With no shares the rate is null so the card
 * can render "--" rather than a misleading 0%.
 */
export function deriveWorkerStats(workers: Worker[]): WorkerStats {
  let activeCount = 0;
  let totalShares = 0;
  let rejectedShares = 0;

  for (const worker of workers) {
    if (worker.is_connected) activeCount += 1;
    totalShares += (worker.total_shares ?? 0) + (worker.fpps_total_shares ?? 0);
    rejectedShares += (worker.rejected_shares ?? 0) + (worker.fpps_rejected_shares ?? 0);
  }

  return {
    activeCount,
    offlineCount: workers.length - activeCount,
    totalCount: workers.length,
    rejectionRate: totalShares > 0 ? rejectedShares / totalShares : null,
  };
}
