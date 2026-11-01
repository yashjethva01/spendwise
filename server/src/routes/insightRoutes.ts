import { Router } from 'express'

import { spendingSummary } from '../controllers/insightController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const insightRoutes = Router()

insightRoutes.use(requireAuth)
insightRoutes.post('/spending-summary', spendingSummary)
