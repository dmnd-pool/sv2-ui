import { z } from 'zod';

const pplnsProjectionDailyWorkSchema = z.object({
  work_day: z.iso.date(),
  retained_difficulty: z.number(),
  projected_net_sats: z.number().int(),
  already_earned_net_sats: z.number().int(),
  total_net_sats: z.number().int(),
  earned_history_complete: z.boolean(),
});

const pplnsProjectionHorizonSchema = z.object({
  horizon: z.number().int(),
  retained_difficulty: z.number(),
  total_modeled_window_difficulty: z.number(),
  difficulty_score: z.number(),
  gross_subsidy_sats: z.number().int(),
  pool_fee: z.number(),
  broker_fee: z.number(),
  net_sats: z.number().int(),
});

const pplnsProjectionSchema = z.object({
  generation_id: z.number().optional(),
  subaccount_id: z.string(),
  calculated_at: z.iso.datetime(),
  source_snapshot_at: z.iso.datetime(),
  source_max_share_idx: z.number().optional(),
  source_job_id: z.number().optional(),
  source_block_height: z.number().int(),
  last_pool_block_height: z.number().int(),
  pool_work_since_last_block: z.number(),
  synthetic_fill_difficulty: z.number(),
  network_difficulty: z.number(),
  block_subsidy_sats: z.number().int(),
  model_version: z.union([z.literal(3), z.literal(4)]),
  earned_history_complete_from_day: z.iso.date(),
  daily_work: z.array(pplnsProjectionDailyWorkSchema),
  horizons: z.array(pplnsProjectionHorizonSchema),
});

export type PplnsProjectionDailyWork = z.infer<typeof pplnsProjectionDailyWorkSchema>;
export type PplnsProjectionHorizon = z.infer<typeof pplnsProjectionHorizonSchema>;
export type PplnsProjection = z.infer<typeof pplnsProjectionSchema>;

/** Decode the common model-3/model-4 response used during the rolling deployment. */
export function decodePplnsProjection(payload: unknown): PplnsProjection {
  const result = pplnsProjectionSchema.safeParse(payload);
  if (!result.success) throw new Error('Invalid or unsupported PPLNS projection response');
  if (result.data.horizons.length !== 9 || result.data.horizons.some((row, index) => row.horizon !== index)) {
    throw new Error('Invalid PPLNS projection horizons');
  }
  return result.data;
}

/** Account ids are signed decimal i64 strings; tolerate harmless signs/leading zeroes. */
export function pplnsProjectionMatchesAccount(projection: PplnsProjection, accountId: string): boolean {
  const responseId = projection.subaccount_id.trim();
  const requestId = accountId.trim();
  if (!/^[+-]?\d+$/.test(responseId) || !/^[+-]?\d+$/.test(requestId)) return false;
  try {
    return BigInt(responseId) === BigInt(requestId);
  } catch {
    return false;
  }
}
