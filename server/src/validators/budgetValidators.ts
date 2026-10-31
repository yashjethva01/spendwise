import { z } from 'zod'

const category = z.string().trim().min(1).max(50)
const year = z.coerce.number().int().min(2000).max(2100)
const month = z.coerce.number().int().min(1).max(12)

export const createBudgetSchema = z.object({
  category,
  year,
  month,
  monthlyLimit: z.number().finite().positive().max(1_000_000_000),
})

export const updateBudgetSchema = createBudgetSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one budget field is required.' },
)

export const budgetPeriodSchema = z.object({ year, month })

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>
export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>
