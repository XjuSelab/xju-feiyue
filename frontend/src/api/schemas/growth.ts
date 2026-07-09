import { z } from 'zod'

/** Mirror of backend `CheckInOut` (POST /auth/me/checkin). */
export const CheckInSchema = z.object({
  checkedInDate: z.string(),
  streak: z.number().int().nonnegative(),
  gainedExp: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  alreadyCheckedIn: z.boolean().default(false),
})
export type CheckIn = z.infer<typeof CheckInSchema>

/** Mirror of backend `XpEventOut` (GET /auth/me/xp-events). */
export const XpEventSchema = z.object({
  id: z.number().int(),
  sourceType: z.string(),
  delta: z.number().int(),
  refType: z.string().nullish(),
  refId: z.string().nullish(),
  note: z.string().nullish(),
  createdAt: z.string(),
})
export type XpEvent = z.infer<typeof XpEventSchema>

export const XpEventListSchema = z.array(XpEventSchema)
