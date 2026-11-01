import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const analytics = {
  income: 50000,
  expenses: 12000,
  netSavings: 38000,
  categorySpending: [{ category: 'Food', amount: 7000 }],
}
const budgets = [{
  category: 'Food',
  monthlyLimit: 10000,
  spent: 7000,
  remaining: 3000,
  usagePercentage: 70,
}]

vi.mock('../src/services/analyticsService.js', () => ({
  getMonthlyTransactionTotals: vi.fn(async () => analytics),
}))

vi.mock('../src/services/budgetService.js', () => ({
  listBudgets: vi.fn(async () => budgets),
}))

const { app } = await import('../src/app.js')
const { env } = await import('../src/config/env.js')

function authHeader(userId = '507f1f77bcf86cd799439011') {
  return `Bearer ${jwt.sign({ sub: userId }, 'test-only-secret-that-is-at-least-32-characters')}`
}

describe('spending insight API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Food is your largest spending category. You are currently within the Food budget.' }] } }],
    }), { status: 200 })))
  })

  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/insights/spending-summary')
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(401)
  })

  it('sends only aggregate data and returns advisory text', async () => {
    const fetchMock = vi.mocked(fetch)
    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader())
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      period: { year: 2026, month: 10 },
      summary: expect.stringContaining('Food'),
      disclaimer: expect.stringContaining('not financial advice'),
    })
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.contents[0].parts[0].text).toContain('"income":50000')
    expect(requestBody.contents[0].parts[0].text).toContain('"monthlyLimit":10000')
    expect(requestBody.contents[0].parts[0].text).not.toContain('password')
    expect(requestBody.contents[0].parts[0].text).not.toContain('@')
  })

  it('returns a safe error for provider failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })))

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439013'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('The AI provider is temporarily busy. Try again shortly.')
  })

  it('rejects malformed provider output safely', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: 'not-text' }] } }],
    }), { status: 200 })))

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439016'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(502)
    expect(response.body.error.message).toBe('The AI provider returned an unusable response.')
  })

  it('rejects invalid periods before calling the provider', async () => {
    const fetchMock = vi.mocked(fetch)
    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439014'))
      .send({ year: 2026, month: 13 })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a clear response when the key is missing', async () => {
    const originalKey = env.geminiApiKey
    Object.defineProperty(env, 'geminiApiKey', { value: undefined, configurable: true })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439015'))
      .send({ year: 2026, month: 10 })

    Object.defineProperty(env, 'geminiApiKey', { value: originalKey, configurable: true })
    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('Spending insights are not configured on the server.')
  })
})
