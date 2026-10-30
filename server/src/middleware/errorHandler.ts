import type { ErrorRequestHandler, RequestHandler } from 'express'

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
  const statusCode = error instanceof AppError ? error.statusCode : 500
  const message =
    error instanceof AppError ? error.message : 'An unexpected server error occurred.'

  if (statusCode >= 500) {
    console.error(error)
  }

  response.status(statusCode).json({
    success: false,
    error: {
      message,
    },
  })
}
