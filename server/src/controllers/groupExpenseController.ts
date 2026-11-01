import type { Request, Response } from 'express'

import {
  createExpense,
  deleteExpense,
  getGroupBalances,
  getSettlementSuggestions,
  listExpenses,
  updateExpense,
} from '../services/groupService.js'
import {
  createGroupExpenseSchema,
  groupExpenseQuerySchema,
  updateGroupExpenseSchema,
} from '../validators/groupValidators.js'

export async function create(request: Request, response: Response): Promise<void> {
  response.status(201).json({ success: true, data: { expense: await createExpense(request.userId!, request.params.groupId as string, createGroupExpenseSchema.parse(request.body)) } })
}
export async function list(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await listExpenses(request.userId!, request.params.groupId as string, groupExpenseQuerySchema.parse(request.query)) })
}
export async function update(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { expense: await updateExpense(request.userId!, request.params.groupId as string, request.params.id as string, updateGroupExpenseSchema.parse(request.body)) } })
}
export async function remove(request: Request, response: Response): Promise<void> {
  await deleteExpense(request.userId!, request.params.groupId as string, request.params.id as string)
  response.status(204).send()
}
export async function balances(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { balances: await getGroupBalances(request.userId!, request.params.groupId as string) } })
}
export async function suggestions(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { settlements: await getSettlementSuggestions(request.userId!, request.params.groupId as string) } })
}
