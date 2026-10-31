import { z } from 'zod'

const transactionType = z.enum(['income', 'expense'])
const transactionDate = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()), {
  message: 'Date must be valid.',
})

export const createTransactionSchema = z.object({
  type: transactionType,
  amount: z.number().finite().positive().max(1_000_000_000),
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).optional(),
  date: transactionDate,
})

export const updateTransactionSchema = createTransactionSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one transaction field is required.' },
)

export const transactionQuerySchema = z
  .object({
    type: transactionType.optional(),
    category: z.string().trim().min(1).max(50).optional(),
    from: transactionDate.optional(),
    to: transactionDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'from must be earlier than or equal to to.',
      })
    }
  })

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type TransactionQuery = z.infer<typeof transactionQuerySchema>
