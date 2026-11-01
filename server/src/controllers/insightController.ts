import type { Request, Response } from 'express'

import { generateSpendingInsight } from '../services/insightService.js'
import { spendingInsightSchema } from '../validators/insightValidators.js'

export async function spendingSummary(
  request: Request,
  response: Response,
): Promise<void> {
  const period = spendingInsightSchema.parse(request.body)
  const insight = await generateSpendingInsight(request.userId!, period)

  response.json({ success: true, data: insight })
}
