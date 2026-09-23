import { z } from 'zod';

/** Current daily earnings response; the dashboard displays unavailable PPLNS H/s as zero. */
const generatedBtcEntrySchema = z.object({
  entry_day: z.iso.date(),
  hashrate: z.number(),
  pplns_hashrate: z.number().nullable().transform((rate) => rate ?? 0),
  fpps_btc_generated: z.number(),
  pplns_btc_generated: z.number(),
  btc_generated: z.number(),
});

export type GeneratedBtcEntry = z.infer<typeof generatedBtcEntrySchema> & { account?: string };

export function decodeGeneratedBtc(payload: unknown): GeneratedBtcEntry[] {
  return z.array(generatedBtcEntrySchema).parse(payload);
}
