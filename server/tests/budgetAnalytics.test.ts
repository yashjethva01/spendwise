import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userOneId = '507f1f77bcf86cd799439011'
const userTwoId = '507f1f77bcf86cd799439012'

type StoredTransaction = {
  userId: string
  type: 'income' | 'expense'
  amount: number
  category: string
  date: Date
}

type StoredBudget = {
  _id: { toString: () => string }
  userId: { toString: () => string }
  category: string
  year: number
  month: number
  monthlyLimit: number
  createdAt: Date
  updatedAt: Date
}

const transactionStore = vi.hoisted(() => [] as StoredTransaction[])
const budgetStore = vi.hoisted(() => new Map<string, StoredBudget>())
let nextBudgetId = 1

function matchesBudget(
  budget: StoredBudget,
  filter: Record<string, unknown>,
): boolean {
  if (filter.userId && budget.userId.toString() !== filter.userId.toString()) return false
  if (filter.category && budget.category !== filter.category) return false
  if (filter.year && budget.year !== filter.year) return false
  if (filter.month && budget.month !== filter.month) return false
  if (filter._id) {
    const idFilter = filter._id as { $ne?: { toString: () => string } } | string
    if (
      typeof idFilter === 'object' &&
      '$ne' in idFilter &&
      idFilter.$ne &&
      budget._id.toString() === idFilter.$ne.toString()
    ) {
      return false
    }
    if (typeof idFilter === 'string' && budget._id.toString() !== idFilter) return false
  }
  return true
}

vi.mock('../src/models/Transaction.js', () => ({
  TransactionModel: {
    aggregate: async (pipeline: Array<Record<string, unknown>>) => {
      const match = pipeline[0].$match as {
        userId: { toString: () => string }
        date: { $gte: Date; $lt: Date }
      }
      const grouped = new Map<string, { type: 'income' | 'expense'; category: string; total: number }>()

      for (const transaction of transactionStore) {
        if (
          transaction.userId !== match.userId.toString() ||
          transaction.date < match.date.$gte ||
          transaction.date >= match.date.$lt
        ) {
          continue
        }

        const key = `${transaction.type}:${transaction.category}`
        const current = grouped.get(key) ?? {
          type: transaction.type,
          category: transaction.category,
          total: 0,
        }
        current.total += transaction.amount
        grouped.set(key, current)
      }

      return [...grouped.values()].map(({ type, category, total }) => ({
        _id: { type, category },
        total,
      }))
    },
  },
}))

vi.mock('../src/models/Budget.js', () => ({
  BudgetModel: {
    findOne: async (filter: Record<string, unknown>) =>
      [...budgetStore.values()].find((budget) => matchesBudget(budget, filter)) ?? null,
    create: async (input: Omit<StoredBudget, '_id' | 'createdAt' | 'updatedAt'>) => {
      const id = `507f1f77bcf86cd7994390${String(nextBudgetId).padStart(2, '0')}`
      const now = new Date()
      const budget = {
        ...input,
        _id: { toString: () => id },
        createdAt: now,
        updatedAt: now,
      }
      budgetStore.set(id, budget)
      nextBudgetId += 1
      return budget
    },
    find: (filter: Record<string, unknown>) => ({
      sort: async () =>
        [...budgetStore.values()]
          .filter((budget) => matchesBudget(budget, filter))
          .sort((left, right) => left.category.localeCompare(right.category)),
    }),
    findOneAndUpdate: async (
      filter: Record<string, unknown>,
      input: Partial<StoredBudget>,
    ) => {
      const budget = [...budgetStore.values()].find((item) => matchesBudget(item, filter))
      if (!budget) return null
      Object.assign(budget, input, { updatedAt: new Date() })
      return budget
    },
    findOneAndDelete: async (filter: Record<string, unknown>) => {
      const entry = [...budgetStore.entries()].find(([, budget]) => matchesBudget(budget, filter))
      if (!entry) return null
      budgetStore.delete(entry[0])
      return entry[1]
    },
  },
}))

const { app } = await import('../src/app.js')

function authHeader(userId: string) {
  return `Bearer ${jwt.sign({ sub: userId }, 'test-only-secret-that-is-at-least-32-characters')}`
}

describe('budget and analytics API', () => {
  beforeEach(() => {
    transactionStore.length = 0
    budgetStore.clear()
    nextBudgetId = 1
  })

  it('returns zero analytics for an empty month', async () => {
    const response = await request(app)
      .get('/api/analytics/monthly?year=2026&month=10')
      .set('Authorization', authHeader(userOneId))

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      income: 0,
      expenses: 0,
      netSavings: 0,
      categorySpending: [],
    })
  })

  it('calculates month boundaries and category totals for one user', async () => {
    transactionStore.push(
      { userId: userOneId, type: 'income', amount: 50000, category: 'Salary', date: new Date('2026-10-01T00:00:00.000Z') },
      { userId: userOneId, type: 'expense', amount: 1000, category: 'Food', date: new Date('2026-10-31T23:59:59.999Z') },
      { userId: userOneId, type: 'expense', amount: 2500, category: 'Food', date: new Date('2026-11-01T00:00:00.000Z') },
      { userId: userTwoId, type: 'expense', amount: 9000, category: 'Food', date: new Date('2026-10-15T00:00:00.000Z') },
    )

    const response = await request(app)
      .get('/api/analytics/monthly?year=2026&month=10')
      .set('Authorization', authHeader(userOneId))

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      income: 50000,
      expenses: 1000,
      netSavings: 49000,
      categorySpending: [{ category: 'Food', amount: 1000 }],
    })
  })

  it('calculates budget usage and prevents duplicate monthly category budgets', async () => {
    transactionStore.push({
      userId: userOneId,
      type: 'expense',
      amount: 2500,
      category: 'Food',
      date: new Date('2026-10-15T00:00:00.000Z'),
    })

    const input = {
      category: 'Food',
      year: 2026,
      month: 10,
      monthlyLimit: 5000,
    }
    const createResponse = await request(app)
      .post('/api/budgets')
      .set('Authorization', authHeader(userOneId))
      .send(input)

    const duplicateResponse = await request(app)
      .post('/api/budgets')
      .set('Authorization', authHeader(userOneId))
      .send(input)

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.data.budget).toMatchObject({
      spent: 2500,
      remaining: 2500,
      usagePercentage: 50,
    })
    expect(duplicateResponse.status).toBe(409)
  })

  it('lists budgets with zero usage and supports update and delete', async () => {
    const createResponse = await request(app)
      .post('/api/budgets')
      .set('Authorization', authHeader(userOneId))
      .send({ category: 'Travel', year: 2026, month: 10, monthlyLimit: 3000 })
    const budgetId = createResponse.body.data.budget.id

    const listResponse = await request(app)
      .get('/api/budgets?year=2026&month=10')
      .set('Authorization', authHeader(userOneId))
    const updateResponse = await request(app)
      .patch(`/api/budgets/${budgetId}`)
      .set('Authorization', authHeader(userOneId))
      .send({ monthlyLimit: 4500 })
    const deleteResponse = await request(app)
      .delete(`/api/budgets/${budgetId}`)
      .set('Authorization', authHeader(userOneId))

    expect(listResponse.body.data.budgets[0]).toMatchObject({ spent: 0, remaining: 3000 })
    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.data.budget.monthlyLimit).toBe(4500)
    expect(deleteResponse.status).toBe(204)
  })

  it('reports overspending from the authenticated user only', async () => {
    transactionStore.push({
      userId: userOneId,
      type: 'expense',
      amount: 1500,
      category: 'Food',
      date: new Date('2026-10-15T00:00:00.000Z'),
    })
    transactionStore.push({
      userId: userTwoId,
      type: 'expense',
      amount: 9000,
      category: 'Food',
      date: new Date('2026-10-15T00:00:00.000Z'),
    })

    const createResponse = await request(app)
      .post('/api/budgets')
      .set('Authorization', authHeader(userOneId))
      .send({ category: 'Food', year: 2026, month: 10, monthlyLimit: 1000 })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.data.budget).toMatchObject({
      spent: 1500,
      remaining: -500,
      usagePercentage: 150,
    })
  })

  it('rejects invalid periods and cross-user budget access', async () => {
    const invalidResponse = await request(app)
      .get('/api/analytics/monthly?year=2026&month=13')
      .set('Authorization', authHeader(userOneId))
    const createResponse = await request(app)
      .post('/api/budgets')
      .set('Authorization', authHeader(userOneId))
      .send({ category: 'Food', year: 2026, month: 10, monthlyLimit: 1000 })
    const budgetId = createResponse.body.data.budget.id
    const crossUserResponse = await request(app)
      .delete(`/api/budgets/${budgetId}`)
      .set('Authorization', authHeader(userTwoId))

    expect(invalidResponse.status).toBe(400)
    expect(crossUserResponse.status).toBe(404)
  })
})
