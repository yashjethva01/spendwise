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

interface GeminiPart {
  text?: unknown
}

interface GeminiCandidate {
  content?: {
    parts?: unknown
  }
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

function extractText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('candidates' in payload)) {
    throw new AppError(502, 'The AI provider returned an invalid response.')
  }

  const candidates = payload.candidates
  if (!Array.isArray(candidates)) {
    throw new AppError(502, 'The AI provider returned an invalid response.')
  }

  const text = candidates
    .flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null || !('content' in candidate)) {
        return []
      }
      const content = candidate.content
      if (typeof content !== 'object' || content === null || !('parts' in content)) {
        return []
      }
      return Array.isArray(content.parts)
        ? content.parts.flatMap((part: GeminiPart) =>
            typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string'
              ? [part.text]
              : [],
          )
        : []
    })
    .join('\n')
    .trim()

  if (!text || text.length > 5000) {
    throw new AppError(502, 'The AI provider returned an unusable response.')
  }

  return text
}

async function requestGemini(prompt: string): Promise<string> {
  if (!env.geminiApiKey) {
    throw new AppError(503, 'Spending insights are not configured on the server.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      },
    )

    if (response.status === 429) {
      throw new AppError(503, 'The AI provider is busy. Try again later.')
    }
    if (response.status === 503) {
      throw new AppError(503, 'The AI provider is temporarily busy. Try again shortly.')
    }
    if (!response.ok) {
      throw new AppError(503, 'Spending insights are temporarily unavailable.')
    }

    return extractText(await response.json())
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(503, 'The AI provider timed out. Try again later.')
    }
    throw new AppError(503, 'Spending insights are temporarily unavailable.')
  } finally {
    clearTimeout(timeout)
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
  const summary = await requestGemini(createPrompt(input))

  return {
    period,
    summary,
    disclaimer: 'Informational only; this is not financial advice.',
  }
}
