import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userOneId = '507f1f77bcf86cd799439011'
const userTwoId = '507f1f77bcf86cd799439012'

type StoredTransaction = {
  _id: { toString: () => string }
  userId: { toString: () => string }
  type: 'income' | 'expense'
  amount: number
  category: string
  description?: string
  date: Date
  createdAt: Date
  updatedAt: Date
}

const transactionStore = vi.hoisted(() => new Map<string, StoredTransaction>())
let nextId = 1

function matches(
  transaction: StoredTransaction,
  filter: Record<string, unknown>,
): boolean {
  if (filter.userId && transaction.userId.toString() !== filter.userId.toString()) {
    return false
  }
  if (filter._id && transaction._id.toString() !== filter._id.toString()) {
    return false
  }
  if (filter.type && transaction.type !== filter.type) {
    return false
  }
  if (filter.category && transaction.category !== filter.category) {
    return false
  }
  const dateFilter = filter.date as
    | { $gte?: Date; $lte?: Date }
    | undefined
  if (dateFilter?.$gte && transaction.date < dateFilter.$gte) return false
  if (dateFilter?.$lte && transaction.date > dateFilter.$lte) return false
  return true
}

vi.mock('../src/models/Transaction.js', () => ({
  TransactionModel: {
    create: async (input: Omit<StoredTransaction, '_id' | 'createdAt' | 'updatedAt'>) => {
      const id = `507f1f77bcf86cd7994390${String(nextId).padStart(2, '0')}`
      const now = new Date()
      const transaction = {
        ...input,
        _id: { toString: () => id },
        createdAt: now,
        updatedAt: now,
      }
      transactionStore.set(id, transaction)
      nextId += 1
      return transaction
    },
    find: (filter: Record<string, unknown>) => {
      let results = [...transactionStore.values()].filter((item) => matches(item, filter))
      return {
        sort: () => ({
          skip: (count: number) => ({
            limit: async (limit: number) => {
              results = results.sort((left, right) => right.date.getTime() - left.date.getTime())
              return results.slice(count, count + limit)
            },
          }),
        }),
      }
    },
    countDocuments: async (filter: Record<string, unknown>) =>
      [...transactionStore.values()].filter((item) => matches(item, filter)).length,
    findOne: async (filter: Record<string, unknown>) =>
      [...transactionStore.values()].find((item) => matches(item, filter)) ?? null,
    findOneAndUpdate: async (
      filter: Record<string, unknown>,
      input: Partial<StoredTransaction>,
    ) => {
      const transaction = [...transactionStore.values()].find((item) => matches(item, filter))
      if (!transaction) return null
      Object.assign(transaction, input, { updatedAt: new Date() })
      return transaction
    },
    findOneAndDelete: async (filter: Record<string, unknown>) => {
      const entry = [...transactionStore.entries()].find(([, item]) => matches(item, filter))
      if (!entry) return null
      transactionStore.delete(entry[0])
      return entry[1]
    },
  },
}))

const { app } = await import('../src/app.js')

function authHeader(userId: string) {
  return `Bearer ${jwt.sign({ sub: userId }, 'test-only-secret-that-is-at-least-32-characters')}`
}

const baseTransaction = {
  type: 'expense',
  amount: 125,
  category: 'Food',
  description: 'Lunch',
  date: '2026-10-15T12:00:00.000Z',
}

describe('transaction API', () => {
  beforeEach(() => {
    transactionStore.clear()
    nextId = 1
  })

  it('creates, retrieves, updates, and deletes an owned transaction', async () => {
    const createResponse = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(userOneId))
      .send(baseTransaction)

    expect(createResponse.status).toBe(201)
    const transactionId = createResponse.body.data.transaction.id

    const getResponse = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set('Authorization', authHeader(userOneId))
    expect(getResponse.status).toBe(200)
    expect(getResponse.body.data.transaction.category).toBe('Food')

    const updateResponse = await request(app)
      .patch(`/api/transactions/${transactionId}`)
      .set('Authorization', authHeader(userOneId))
      .send({ amount: 200 })
    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.data.transaction.amount).toBe(200)

    const deleteResponse = await request(app)
      .delete(`/api/transactions/${transactionId}`)
      .set('Authorization', authHeader(userOneId))
    expect(deleteResponse.status).toBe(204)
  })

  it('filters transactions and paginates results', async () => {
    for (const transaction of [
      { ...baseTransaction, category: 'Food', date: '2026-10-15T12:00:00.000Z' },
      { ...baseTransaction, category: 'Transport', date: '2026-10-16T12:00:00.000Z' },
      { ...baseTransaction, type: 'income' as const, category: 'Salary', date: '2026-10-17T12:00:00.000Z' },
    ]) {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', authHeader(userOneId))
        .send(transaction)
    }

    const response = await request(app)
      .get('/api/transactions?type=expense&from=2026-10-01&to=2026-10-31&page=1&limit=1')
      .set('Authorization', authHeader(userOneId))

    expect(response.status).toBe(200)
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    })
  })

  it('rejects invalid transaction input and filters', async () => {
    const invalidBodyResponse = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(userOneId))
      .send({ ...baseTransaction, amount: 0, type: 'gift' })

    const invalidQueryResponse = await request(app)
      .get('/api/transactions?from=2026-11-01&to=2026-10-01')
      .set('Authorization', authHeader(userOneId))

    expect(invalidBodyResponse.status).toBe(400)
    expect(invalidQueryResponse.status).toBe(400)
  })

  it('denies cross-user reads, updates, and deletes', async () => {
    const createResponse = await request(app)
      .post('/api/transactions')
      .set('Authorization', authHeader(userOneId))
      .send(baseTransaction)
    const transactionId = createResponse.body.data.transaction.id

    const getResponse = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set('Authorization', authHeader(userTwoId))
    const updateResponse = await request(app)
      .patch(`/api/transactions/${transactionId}`)
      .set('Authorization', authHeader(userTwoId))
      .send({ amount: 999 })
    const deleteResponse = await request(app)
      .delete(`/api/transactions/${transactionId}`)
      .set('Authorization', authHeader(userTwoId))

    expect(getResponse.status).toBe(404)
    expect(updateResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
  })

  it('rejects malformed IDs and unauthenticated requests', async () => {
    const invalidIdResponse = await request(app)
      .get('/api/transactions/not-an-id')
      .set('Authorization', authHeader(userOneId))
    const unauthenticatedResponse = await request(app).get('/api/transactions')

    expect(invalidIdResponse.status).toBe(400)
    expect(unauthenticatedResponse.status).toBe(401)
  })
})
