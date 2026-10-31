import type { Request, Response } from 'express'

import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from '../services/budgetService.js'
import {
  budgetPeriodSchema,
  createBudgetSchema,
  updateBudgetSchema,
} from '../validators/budgetValidators.js'

export async function create(request: Request, response: Response): Promise<void> {
  const budget = await createBudget(
    request.userId!,
    createBudgetSchema.parse(request.body),
  )
  response.status(201).json({ success: true, data: { budget } })
}

export async function list(request: Request, response: Response): Promise<void> {
  const period = budgetPeriodSchema.parse(request.query)
  const budgets = await listBudgets(request.userId!, period)
  response.json({ success: true, data: { budgets, period } })
}

export async function update(request: Request, response: Response): Promise<void> {
  const id = request.params.id
  const budget = await updateBudget(
    request.userId!,
    typeof id === 'string' ? id : '',
    updateBudgetSchema.parse(request.body),
  )
  response.json({ success: true, data: { budget } })
}

export async function remove(request: Request, response: Response): Promise<void> {
  const id = request.params.id
  await deleteBudget(request.userId!, typeof id === 'string' ? id : '')
  response.status(204).send()
}
