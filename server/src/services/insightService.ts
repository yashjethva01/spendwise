import Groq from 'groq-sdk'

import { env } from '../config/env.js'
import { AppError } from '../middleware/errorHandler.js'
import { listBudgets } from './budgetService.js'
import { getMonthlyTransactionTotals } from './analyticsService.js'
import type { SpendingInsightInput } from '../validators/insightValidators.js'

const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 5
const requestWindows = new Map<string, number[]>()

interface InsightInput {
  period: SpendingInsightInput
  analytics: Awaited<ReturnType<typeof getMonthlyTransactionTotals>>
  budgets: Array<{
    category: string
    monthlyLimit: number
    spent: number
    remaining: number
    usagePercentage: number
  }>
}

export function buildInsightInput(
  period: SpendingInsightInput,
  analytics: Awaited<ReturnType<typeof getMonthlyTransactionTotals>>,
  budgets: Awaited<ReturnType<typeof listBudgets>>,
): InsightInput {
  return {
    period,
    analytics,
    budgets: budgets.map((budget) => ({
      category: budget.category,
      monthlyLimit: budget.monthlyLimit,
      spent: budget.spent,
      remaining: budget.remaining,
      usagePercentage: budget.usagePercentage,
    })),
  }
}

function assertWithinRateLimit(userId: string): void {
  const now = Date.now()
  const recentRequests = (requestWindows.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  )

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new AppError(429, 'Insight requests are temporarily limited. Try again later.')
  }

  recentRequests.push(now)
  requestWindows.set(userId, recentRequests)
}

function createPrompt(input: InsightInput): string {
  return [
    'You are a concise spending-pattern assistant for a personal finance app.',
    'Use only the supplied JSON figures. Do not invent, estimate, or recalculate numbers.',
    'Explain notable spending patterns, category trends, and budget utilization.',
    'Give 2 or 3 practical, non-prescriptive observations in plain text.',
    'Do not provide investment, tax, loan, or other financial advice.',
    'Do not mention data that is not present in the JSON.',
    'Return only the advisory summary, without markdown tables.',
    `JSON: ${JSON.stringify(input)}`,
  ].join('\n')
}

function extractText(content: unknown): string {
  const text = typeof content === 'string' ? content.trim() : ''
  if (!text || text.length > 5000) {
    throw new AppError(502, 'The AI provider returned an unusable response.')
  }

  return text
}

const MAX_PROVIDER_ATTEMPTS = 3
const RETRY_DELAYS_MS = [150, 300]
const MAX_RETRY_AFTER_MS = 10_000

interface ProviderErrorDetails {
  status?: number
  message: string
  type?: string
  code?: string
  requestId?: string
  retryAfterMs?: number
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  return value
    .replace(/\b(?:gsk|sk)_[A-Za-z0-9_-]+\b/g, '[redacted]')
    .slice(0, maxLength)
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (headers && typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function') {
    return boundedString(headers.get(name), 100)
  }
  return undefined
}

function getProviderErrorDetails(error: unknown): ProviderErrorDetails {
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const body = typeof record.error === 'object' && record.error !== null
      ? record.error as Record<string, unknown>
      : {}
    return {
      status: typeof record.status === 'number' ? record.status : undefined,
      message: boundedString(body.message, 500) ?? boundedString(record.message, 500) ?? 'Unknown provider error',
      type: boundedString(body.type, 100) ?? boundedString(record.type, 100),
      code: boundedString(body.code, 100) ?? boundedString(record.code, 100),
      requestId: boundedString(record.requestId, 100)
        ?? headerValue(record.headers, 'x-request-id')
        ?? headerValue(record.headers, 'request-id'),
      retryAfterMs: parseRetryAfter(record.headers),
    }
  }

  return { message: error instanceof Error ? boundedString(error.message, 500) ?? 'Unknown provider error' : 'Unknown provider error' }
}

function parseRetryAfter(headers: unknown): number | undefined {
  const value = headerValue(headers, 'retry-after')
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), MAX_RETRY_AFTER_MS)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS)
}

function isRetryableProviderError(details: ProviderErrorDetails): boolean {
  return details.status === 408 || details.status === 409 || details.status === 429 || (details.status !== undefined && details.status >= 500)
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'APIConnectionTimeoutError')
}

function logProviderFailure(details: ProviderErrorDetails): void {
  console.error('Groq insight request failed', {
    status: details.status,
    providerMessage: details.message,
    providerType: details.type,
    providerCode: details.code,
    requestId: details.requestId,
  })
}

async function requestGroq(prompt: string): Promise<string> {
  if (!env.groqApiKey || env.groqApiKey === 'your_groq_api_key_here') {
    throw new AppError(503, 'Spending insights are not configured on the server.')
  }

  const client = new Groq({
    apiKey: env.groqApiKey,
    maxRetries: 0,
    timeout: 15_000,
  })

  try {
    for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
      try {
        const completion = await client.chat.completions.create({
          model: env.groqModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 400,
        })
        return extractText(completion.choices[0]?.message?.content)
      } catch (error) {
        const details = getProviderErrorDetails(error)
        if (!isRetryableProviderError(details) || attempt === MAX_PROVIDER_ATTEMPTS - 1) {
          throw error
        }
        const delay = details.retryAfterMs ?? RETRY_DELAYS_MS[attempt]
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    throw new AppError(503, 'Spending insights are temporarily unavailable.')
  } catch (error) {
    const details = getProviderErrorDetails(error)
    logProviderFailure(details)
    if (error instanceof AppError) {
      throw error
    }
    if (isTimeoutError(error)) {
      throw new AppError(503, 'The AI provider timed out. Try again later.')
    }
    if (details.status === 401) {
      throw new AppError(503, 'Spending insights are not configured correctly on the server.')
    }
    if (details.status === 403) {
      throw new AppError(503, 'The Groq account is not permitted to use the configured spending-insights model.')
    }
    if (details.status === 400 || details.status === 404) {
      throw new AppError(503, 'Spending insights are misconfigured on the server. Check GROQ_MODEL and provider settings.')
    }
    if (isRetryableProviderError(details)) {
      throw new AppError(503, 'The AI provider is temporarily busy. Try again shortly.')
    }
    throw new AppError(503, 'Spending insights are temporarily unavailable.')
  }
}

export async function generateSpendingInsight(
  userId: string,
  period: SpendingInsightInput,
) {
  assertWithinRateLimit(userId)
  const [analytics, budgets] = await Promise.all([
    getMonthlyTransactionTotals(userId, period),
    listBudgets(userId, period),
  ])
  const input = buildInsightInput(period, analytics, budgets)
  const summary = await requestGroq(createPrompt(input))

  return {
    period,
    summary,
    disclaimer: 'Informational only; this is not financial advice.',
  }
}
