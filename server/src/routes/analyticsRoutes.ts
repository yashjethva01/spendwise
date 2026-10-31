import { Router } from 'express'

import { monthly } from '../controllers/analyticsController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const analyticsRoutes = Router()

analyticsRoutes.use(requireAuth)
analyticsRoutes.get('/monthly', monthly)
