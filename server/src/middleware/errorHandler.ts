import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(404, `Route not found: ${request.method} ${request.originalUrl}`))
}

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  const isValidationError = error instanceof ZodError
  const isDuplicateKeyError =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  const statusCode = error instanceof AppError
    ? error.statusCode
    : isValidationError
      ? 400
      : isDuplicateKeyError
        ? 409
        : 500
  const message = error instanceof AppError
    ? error.message
    : isValidationError
      ? 'Invalid request data.'
      : isDuplicateKeyError
        ? 'An account with that email already exists.'
        : 'An unexpected server error occurred.'

  if (statusCode >= 500) {
    console.error(error)
  }

  response.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(isValidationError
        ? {
            fields: error.issues.reduce<Record<string, string>>((fields, issue) => {
              const field = issue.path.join('.') || 'request'
              fields[field] = issue.message
              return fields
            }, {}),
          }
        : {}),
    },
  })
}
