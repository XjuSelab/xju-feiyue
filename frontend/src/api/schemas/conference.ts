import { z } from 'zod'

export const ConferenceSchema = z.object({
  id: z.string(),
  abbr: z.string(),
  name_full: z.string(),
  field: z.string(),
  tier: z.enum(['A', 'B', 'C']),
  publisher: z.string(),
  dblp: z.string(),
  homepage: z.string().nullable(),
  cycle: z.string().nullable(),
  location: z.string().nullable(),
  conf_date: z.string().nullable(),
  deadline: z.string().nullable(),
  note: z.string().nullable(),
  submissions: z.number().int().nullable(),
  accepted: z.number().int().nullable(),
  acceptance_rate: z.number().nullable(),
  stats_year: z.number().int().nullable(),
})
export type ConferenceRow = z.infer<typeof ConferenceSchema>

export const ConfManifestSchema = z.object({
  schema_version: z.number().int().nullable(),
  exported_at: z.string().nullable(),
  claw_version: z.string().nullable(),
  conferences_sqlite_sha256: z.string().nullable(),
  conferences_sqlite_bytes: z.number().int().nullable(),
  counts: z.record(z.string(), z.number()).nullable(),
})

export const ConferencesOutSchema = z.object({
  conferences: z.array(ConferenceSchema),
  count: z.number().int().nonnegative(),
  manifest: ConfManifestSchema.nullable(),
})
export type ConferencesOut = z.infer<typeof ConferencesOutSchema>
