import { Router } from 'express'

import * as expenses from '../controllers/groupExpenseController.js'
import * as settlements from '../controllers/groupSettlementController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const groupExpenseRoutes = Router({ mergeParams: true })
groupExpenseRoutes.use(requireAuth)
groupExpenseRoutes.get('/', expenses.list)
groupExpenseRoutes.post('/', expenses.create)
groupExpenseRoutes.patch('/:id', expenses.update)
groupExpenseRoutes.delete('/:id', expenses.remove)
groupExpenseRoutes.get('/balances', expenses.balances)
groupExpenseRoutes.get('/settlement-suggestions', expenses.suggestions)
groupExpenseRoutes.get('/settlements', settlements.list)
groupExpenseRoutes.post('/settlements', settlements.create)
