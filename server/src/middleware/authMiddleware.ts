import jwt from 'jsonwebtoken'
import type { RequestHandler } from 'express'

import { env } from '../config/env.js'
import { AppError } from './errorHandler.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.header('Authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined

  if (!token) {
    next(new AppError(401, 'Authentication required.'))
    return
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new AppError(401, 'Invalid authentication token.')
    }

    request.userId = payload.sub
    next()
  } catch {
    next(new AppError(401, 'Invalid or expired authentication token.'))
  }
}
