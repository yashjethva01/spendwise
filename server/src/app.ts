import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/authRoutes.js'
import { healthRoutes } from './routes/healthRoutes.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.clientUrl }))
app.use(express.json({ limit: '10kb' }))

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use(notFoundHandler)
app.use(errorHandler)
