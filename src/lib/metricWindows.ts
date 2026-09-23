/**
 * User-facing descriptions of the time windows implemented by the dashboard API.
 * Keep these together so the same metric cannot acquire different definitions on
 * the home, workers, subaccounts, and watcher-link views.
 */
export const LIVE_HASHRATE_HINT =
  'Average hashrate over the last 10 minutes.';

export const HASHRATE_HISTORY_HINT =
  'Hashrate history for the selected time range.';

export const WORKER_ROSTER_HINT =
  'Total number of workers seen in the last 24 hours.';

export const OFFLINE_WORKER_HINT =
  'Seen in the last 24 hours, but currently offline.';

export const ACTIVE_WORKERS_HINT =
  'Total number of workers active in the last 10 minutes.';

export const WORKER_METRICS_HINT =
  'Average hashrate over the last 10 minutes.';

export const SUBACCOUNTS_LIVE_HASHRATE_HINT =
  'Average hashrate over the last 10 minutes across all subaccounts.';

export const WORKER_REJECTION_HINT =
  'Percentage of shares rejected in the last 10 minutes.';

export const ACCOUNT_REJECTION_HINT =
  'Percentage of shares rejected in the last 24 hours.';

export const DAILY_HASHRATE_HINT = 'Average FPPS hashrate for this UTC day.';

export const GENERATED_AVG_HASHRATE_HINT =
  'Average of the daily FPPS hashrate readings in the rows below.';
