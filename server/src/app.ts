import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/authRoutes.js'
import { analyticsRoutes } from './routes/analyticsRoutes.js'
import { budgetRoutes } from './routes/budgetRoutes.js'
import { healthRoutes } from './routes/healthRoutes.js'
import { insightRoutes } from './routes/insightRoutes.js'
import { transactionRoutes } from './routes/transactionRoutes.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.clientUrl }))
app.use(express.json({ limit: '10kb' }))

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/budgets', budgetRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/insights', insightRoutes)
app.use(notFoundHandler)
app.use(errorHandler)
