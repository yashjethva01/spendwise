import cors from 'cors'
import express from 'express'

import { env } from './config/env.js'

export const app = express()

app.use(cors({ origin: env.clientUrl }))
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'spendwise-server',
  })
})
