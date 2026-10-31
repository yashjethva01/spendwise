import { Types } from 'mongoose'

import { AppError } from '../middleware/errorHandler.js'
import { BudgetModel, type BudgetDocument } from '../models/Budget.js'
import { getMonthlyTransactionTotals } from './analyticsService.js'
import type {
  BudgetPeriod,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../validators/budgetValidators.js'

function parseBudgetId(budgetId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(budgetId)) {
    throw new AppError(400, 'Budget ID must be valid.')
  }

  return new Types.ObjectId(budgetId)
}

function toBudgetResponse(
  budget: BudgetDocument,
  spendingByCategory: Map<string, number>,
) {
  const spent = spendingByCategory.get(budget.category) ?? 0

  return {
    id: budget._id.toString(),
    userId: budget.userId.toString(),
    category: budget.category,
    year: budget.year,
    month: budget.month,
    monthlyLimit: budget.monthlyLimit,
    spent,
    remaining: budget.monthlyLimit - spent,
    usagePercentage: (spent / budget.monthlyLimit) * 100,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  }
}

async function spendingMap(userId: string, period: BudgetPeriod) {
  const analytics = await getMonthlyTransactionTotals(userId, period)
  return new Map(
    analytics.categorySpending.map(({ category, amount }) => [category, amount]),
  )
}

export async function createBudget(userId: string, input: CreateBudgetInput) {
  const owner = new Types.ObjectId(userId)
  const duplicate = await BudgetModel.findOne({
    userId: owner,
    category: input.category,
    year: input.year,
    month: input.month,
  })

  if (duplicate) {
    throw new AppError(409, 'A budget already exists for this category and month.')
  }

  const budget = await BudgetModel.create({ ...input, userId: owner })
  const spending = await spendingMap(userId, input)
  return toBudgetResponse(budget, spending)
}

export async function listBudgets(userId: string, period: BudgetPeriod) {
  const owner = new Types.ObjectId(userId)
  const [budgets, spending] = await Promise.all([
    BudgetModel.find({ userId: owner, ...period }).sort({ category: 1 }),
    spendingMap(userId, period),
  ])

  return budgets.map((budget) => toBudgetResponse(budget, spending))
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
) {
  const owner = new Types.ObjectId(userId)
  const existing = await BudgetModel.findOne({
    _id: parseBudgetId(budgetId),
    userId: owner,
  })

  if (!existing) {
    throw new AppError(404, 'Budget not found.')
  }

  const nextValues = {
    category: input.category ?? existing.category,
    year: input.year ?? existing.year,
    month: input.month ?? existing.month,
  }
  const duplicate = await BudgetModel.findOne({
    _id: { $ne: existing._id },
    userId: owner,
    ...nextValues,
  })

  if (duplicate) {
    throw new AppError(409, 'A budget already exists for this category and month.')
  }

  const budget = await BudgetModel.findOneAndUpdate(
    { _id: existing._id, userId: owner },
    input,
    { new: true, runValidators: true },
  )

  if (!budget) {
    throw new AppError(404, 'Budget not found.')
  }

  const spending = await spendingMap(userId, {
    year: budget.year,
    month: budget.month,
  })
  return toBudgetResponse(budget, spending)
}

export async function deleteBudget(userId: string, budgetId: string) {
  const budget = await BudgetModel.findOneAndDelete({
    _id: parseBudgetId(budgetId),
    userId: new Types.ObjectId(userId),
  })

  if (!budget) {
    throw new AppError(404, 'Budget not found.')
  }
}
