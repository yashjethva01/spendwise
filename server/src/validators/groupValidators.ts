import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID must be valid.')
const groupType = z.enum(['trip', 'home', 'couple', 'friends', 'other'])
const splitMethod = z.enum(['equal', 'exact', 'percentage'])
const date = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'Date must be valid.')

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  type: groupType,
})

export const updateGroupSchema = createGroupSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one group field is required.',
)

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
})

export const invitationResponseSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

const participantSchema = z.object({
  userId: objectId,
  value: z.number().finite().nonnegative().optional(),
})

export const createGroupExpenseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().safe().positive().max(100_000_000_000),
  currency: z.literal('INR').default('INR'),
  category: z.string().trim().min(1).max(50),
  date,
  payerId: objectId,
  participants: z.array(participantSchema).min(1).max(100),
  splitMethod,
  notes: z.string().trim().max(500).optional(),
})

export const updateGroupExpenseSchema = createGroupExpenseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one expense field is required.',
)

export const groupExpenseQuerySchema = z.object({
  category: z.string().trim().min(1).max(50).optional(),
  payerId: objectId.optional(),
  memberId: objectId.optional(),
  from: date.optional(),
  to: date.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).superRefine((query, context) => {
  if (query.from && query.to && query.from > query.to) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'from must be earlier than or equal to to.' })
  }
})

export const settlementSchema = z.object({
  payerId: objectId,
  recipientId: objectId,
  amountMinor: z.number().int().safe().positive().max(100_000_000_000),
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type CreateGroupExpenseInput = z.infer<typeof createGroupExpenseSchema>
export type UpdateGroupExpenseInput = z.infer<typeof updateGroupExpenseSchema>
export type GroupExpenseQuery = z.infer<typeof groupExpenseQuerySchema>
export type SettlementInput = z.infer<typeof settlementSchema>
