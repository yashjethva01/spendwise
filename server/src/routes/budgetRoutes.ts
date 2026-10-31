import { Router } from 'express'

import { create, list, remove, update } from '../controllers/budgetController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const budgetRoutes = Router()

budgetRoutes.use(requireAuth)
budgetRoutes.post('/', create)
budgetRoutes.get('/', list)
budgetRoutes.patch('/:id', update)
budgetRoutes.delete('/:id', remove)
