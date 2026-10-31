import { Types } from 'mongoose'

import { AppError } from '../middleware/errorHandler.js'
import {
  TransactionModel,
  type TransactionDocument,
} from '../models/Transaction.js'
import type {
  CreateTransactionInput,
  TransactionQuery,
  UpdateTransactionInput,
} from '../validators/transactionValidators.js'

function parseTransactionId(transactionId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(transactionId)) {
    throw new AppError(400, 'Transaction ID must be valid.')
  }

  return new Types.ObjectId(transactionId)
}

function toTransactionResponse(transaction: TransactionDocument) {
  return {
    id: transaction._id.toString(),
    userId: transaction.userId.toString(),
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    date: transaction.date,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  }
}

function getDateFilter(query: TransactionQuery) {
  if (!query.from && !query.to) {
    return undefined
  }

  return {
    ...(query.from ? { $gte: query.from } : {}),
    ...(query.to ? { $lte: query.to } : {}),
  }
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
) {
  const transaction = await TransactionModel.create({
    ...input,
    userId: new Types.ObjectId(userId),
  })

  return toTransactionResponse(transaction)
}

export async function listTransactions(userId: string, query: TransactionQuery) {
  const filter = {
    userId: new Types.ObjectId(userId),
    ...(query.type ? { type: query.type } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(getDateFilter(query) ? { date: getDateFilter(query) } : {}),
  }
  const skip = (query.page - 1) * query.limit

  const [transactions, total] = await Promise.all([
    TransactionModel.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    TransactionModel.countDocuments(filter),
  ])

  return {
    items: transactions.map(toTransactionResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  }
}

export async function getTransaction(userId: string, transactionId: string) {
  const transaction = await TransactionModel.findOne({
    _id: parseTransactionId(transactionId),
    userId: new Types.ObjectId(userId),
  })

  if (!transaction) {
    throw new AppError(404, 'Transaction not found.')
  }

  return toTransactionResponse(transaction)
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
) {
  const transaction = await TransactionModel.findOneAndUpdate(
    {
      _id: parseTransactionId(transactionId),
      userId: new Types.ObjectId(userId),
    },
    input,
    { new: true, runValidators: true },
  )

  if (!transaction) {
    throw new AppError(404, 'Transaction not found.')
  }

  return toTransactionResponse(transaction)
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const transaction = await TransactionModel.findOneAndDelete({
    _id: parseTransactionId(transactionId),
    userId: new Types.ObjectId(userId),
  })

  if (!transaction) {
    throw new AppError(404, 'Transaction not found.')
  }
}
