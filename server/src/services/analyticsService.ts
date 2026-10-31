import { Types } from 'mongoose'

import { TransactionModel } from '../models/Transaction.js'
import type { MonthlyAnalyticsInput } from '../validators/analyticsValidators.js'

export interface CategorySpending {
  category: string
  amount: number
}

export async function getMonthlyTransactionTotals(
  userId: string,
  period: MonthlyAnalyticsInput,
) {
  const start = new Date(Date.UTC(period.year, period.month - 1, 1))
  const end = new Date(Date.UTC(period.year, period.month, 1))
  const rows = await TransactionModel.aggregate<{
    _id: { type: 'income' | 'expense'; category: string }
    total: number
  }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: { type: '$type', category: '$category' },
        total: { $sum: '$amount' },
      },
    },
  ])

  let income = 0
  let expenses = 0
  const categoryTotals = new Map<string, number>()

  for (const row of rows) {
    if (row._id.type === 'income') {
      income += row.total
    } else {
      expenses += row.total
      categoryTotals.set(
        row._id.category,
        (categoryTotals.get(row._id.category) ?? 0) + row.total,
      )
    }
  }

  return {
    income,
    expenses,
    netSavings: income - expenses,
    categorySpending: [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((left, right) => right.amount - left.amount),
  }
}
