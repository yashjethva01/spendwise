import { Router } from 'express'

import * as groups from '../controllers/groupController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const groupRoutes = Router()
groupRoutes.use(requireAuth)
groupRoutes.get('/invitations', groups.invitations)
groupRoutes.post('/', groups.create)
groupRoutes.get('/', groups.list)
groupRoutes.get('/:id', groups.details)
groupRoutes.patch('/:id', groups.update)
groupRoutes.post('/:id/invitations', groups.invite)
groupRoutes.post('/:id/leave', groups.leave)
groupRoutes.post('/invitations/:id/respond', groups.respond)
