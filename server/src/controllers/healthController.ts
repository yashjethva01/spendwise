import type { Request, Response } from 'express'

import { getDatabaseStatus } from '../config/database.js'

export function getHealth(_request: Request, response: Response): void {
  const database = getDatabaseStatus()
  const healthy = database === 'connected'

  response.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      service: 'spendwise-server',
      database,
    },
  })
}
