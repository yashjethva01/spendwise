import type { Request, Response } from 'express'

import { getMonthlyTransactionTotals } from '../services/analyticsService.js'
import { monthlyAnalyticsSchema } from '../validators/analyticsValidators.js'

export async function monthly(request: Request, response: Response): Promise<void> {
  const period = monthlyAnalyticsSchema.parse(request.query)
  const totals = await getMonthlyTransactionTotals(request.userId!, period)

  response.json({
    success: true,
    data: { period, ...totals },
  })
}
