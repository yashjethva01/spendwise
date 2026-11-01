import { Router } from 'express'

import { changePassword, login, me, register, updateProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const authRoutes = Router()

authRoutes.post('/register', register)
authRoutes.post('/login', login)
authRoutes.get('/me', requireAuth, me)
authRoutes.patch('/me', requireAuth, updateProfile)
authRoutes.post('/me/password', requireAuth, changePassword)
