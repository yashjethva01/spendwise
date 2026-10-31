import { Router } from 'express'

import {
  create,
  get,
  list,
  remove,
  update,
} from '../controllers/transactionController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const transactionRoutes = Router()

transactionRoutes.use(requireAuth)
transactionRoutes.post('/', create)
transactionRoutes.get('/', list)
transactionRoutes.get('/:id', get)
transactionRoutes.patch('/:id', update)
transactionRoutes.delete('/:id', remove)
