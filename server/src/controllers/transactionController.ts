import type { Request, Response } from 'express'

import { AppError } from '../middleware/errorHandler.js'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '../services/transactionService.js'
import {
  createTransactionSchema,
  transactionQuerySchema,
  updateTransactionSchema,
} from '../validators/transactionValidators.js'

function getTransactionId(request: Request): string {
  const { id } = request.params

  if (typeof id !== 'string') {
    throw new AppError(400, 'Transaction ID must be valid.')
  }

  return id
}

export async function create(request: Request, response: Response): Promise<void> {
  const transaction = await createTransaction(
    request.userId!,
    createTransactionSchema.parse(request.body),
  )

  response.status(201).json({ success: true, data: { transaction } })
}

export async function list(request: Request, response: Response): Promise<void> {
  const result = await listTransactions(
    request.userId!,
    transactionQuerySchema.parse(request.query),
  )

  response.json({ success: true, data: result })
}

export async function get(request: Request, response: Response): Promise<void> {
  const transaction = await getTransaction(request.userId!, getTransactionId(request))

  response.json({ success: true, data: { transaction } })
}

export async function update(request: Request, response: Response): Promise<void> {
  const transaction = await updateTransaction(
    request.userId!,
    getTransactionId(request),
    updateTransactionSchema.parse(request.body),
  )

  response.json({ success: true, data: { transaction } })
}

export async function remove(request: Request, response: Response): Promise<void> {
  await deleteTransaction(request.userId!, getTransactionId(request))
  response.status(204).send()
}
