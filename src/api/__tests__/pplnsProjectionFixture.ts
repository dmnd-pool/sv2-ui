import type { PplnsProjection } from '../types';

export function pplnsProjectionFixture(modelVersion: 3 | 4 = 4): PplnsProjection {
  return {
    generation_id: 42,
    subaccount_id: '123',
    calculated_at: '2026-08-31T12:00:00Z',
    source_snapshot_at: '2026-08-31T12:00:00Z',
    source_max_share_idx: 987654,
    source_job_id: 3607772528640001,
    source_block_height: 840000,
    last_pool_block_height: 839900,
    pool_work_since_last_block: 50000000,
    synthetic_fill_difficulty: 73456789,
    network_difficulty: 123456789,
    block_subsidy_sats: 312500000,
    model_version: modelVersion,
    earned_history_complete_from_day: '2026-08-01',
    daily_work: [
      {
        work_day: '2026-08-31',
        retained_difficulty: 1,
        projected_net_sats: 999,
        already_earned_net_sats: 1,
        total_net_sats: 1000,
        earned_history_complete: true,
      },
    ],
    horizons: Array.from({ length: 9 }, (_, horizon) => ({
      horizon,
      retained_difficulty: 1,
      total_modeled_window_difficulty: 1,
      difficulty_score: 1,
      gross_subsidy_sats: 1,
      pool_fee: 0,
      broker_fee: 0,
      net_sats: 1,
    })),
  };
}
