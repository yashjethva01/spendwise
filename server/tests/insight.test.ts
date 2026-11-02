import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const groqCreate = vi.hoisted(() => vi.fn())

vi.mock('groq-sdk', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create: groqCreate } },
  })),
}))

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
      groqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Food is your largest spending category. You are currently within the Food budget.' } }],
      })
  })

  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/insights/spending-summary')
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(401)
  })

  it('sends only aggregate data and returns advisory text', async () => {
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
    const requestBody = groqCreate.mock.calls[0]?.[0]
    expect(requestBody.messages[0].content).toContain('"income":50000')
    expect(requestBody.messages[0].content).toContain('"monthlyLimit":10000')
    expect(requestBody.messages[0].content).not.toContain('password')
    expect(requestBody.messages[0].content).not.toContain('@')
  })

  it('returns a safe error for provider failures', async () => {
    groqCreate.mockRejectedValue({ status: 503 })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439013'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('The AI provider is temporarily busy. Try again shortly.')
  })

  it('does not retry or expose details for an invalid model request', async () => {
    groqCreate.mockRejectedValue({
      status: 400,
      message: 'The model `invalid-model` does not exist.',
      type: 'invalid_request_error',
      code: 'model_not_found',
    })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439020'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('Spending insights are misconfigured on the server. Check GROQ_MODEL and provider settings.')
    expect(response.body.error.message).not.toContain('invalid-model')
    expect(groqCreate).toHaveBeenCalledTimes(1)
  })

  it('does not expose provider details for invalid API keys', async () => {
    groqCreate.mockRejectedValue({ status: 401, message: 'invalid api key secret' })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439018'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('Spending insights are not configured correctly on the server.')
    expect(response.body.error.message).not.toContain('secret')
  })

  it('returns a safe timeout response', async () => {
    const timeout = new Error('provider timeout')
    timeout.name = 'APIConnectionTimeoutError'
    groqCreate.mockRejectedValue(timeout)

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439019'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('The AI provider timed out. Try again later.')
  })

  it('rejects malformed provider output safely', async () => {
    groqCreate.mockResolvedValue({ choices: [{ message: { content: null } }] })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439016'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(502)
    expect(response.body.error.message).toBe('The AI provider returned an unusable response.')
  })

  it('rejects invalid periods before calling the provider', async () => {
    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439014'))
      .send({ year: 2026, month: 13 })

    expect(response.status).toBe(400)
    expect(groqCreate).not.toHaveBeenCalled()
  })

  it('returns a clear response when the key is missing', async () => {
    const originalKey = env.groqApiKey
    Object.defineProperty(env, 'groqApiKey', { value: undefined, configurable: true })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439015'))
      .send({ year: 2026, month: 10 })

    Object.defineProperty(env, 'groqApiKey', { value: originalKey, configurable: true })
    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('Spending insights are not configured on the server.')
  })

  it('retries temporary provider failures with bounded backoff', async () => {
    groqCreate
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Try again succeeded.' } }] })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439017'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(200)
    expect(groqCreate).toHaveBeenCalledTimes(2)
  })

  it('uses a provider retry-after header for rate limits', async () => {
    groqCreate
      .mockRejectedValueOnce({ status: 429, headers: new Headers({ 'retry-after': '0' }) })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Rate limit cleared.' } }] })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439022'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(200)
    expect(groqCreate).toHaveBeenCalledTimes(2)
  })

  it('does not retry permission errors', async () => {
    groqCreate.mockRejectedValue({ status: 403, message: 'model access denied', type: 'permission_error' })

    const response = await request(app)
      .post('/api/insights/spending-summary')
      .set('Authorization', authHeader('507f1f77bcf86cd799439021'))
      .send({ year: 2026, month: 10 })

    expect(response.status).toBe(503)
    expect(response.body.error.message).toBe('The Groq account is not permitted to use the configured spending-insights model.')
    expect(groqCreate).toHaveBeenCalledTimes(1)
  })
})
