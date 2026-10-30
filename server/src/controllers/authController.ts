import type { Request, Response } from 'express'

import { getUserById, loginUser, registerUser } from '../services/authService.js'
import { loginSchema, registerSchema } from '../validators/authValidators.js'

export async function register(request: Request, response: Response): Promise<void> {
  const input = registerSchema.parse(request.body)
  const result = await registerUser(input)

  response.status(201).json({ success: true, data: result })
}

export async function login(request: Request, response: Response): Promise<void> {
  const input = loginSchema.parse(request.body)
  const result = await loginUser(input)

  response.status(200).json({ success: true, data: result })
}

export async function me(request: Request, response: Response): Promise<void> {
  const user = await getUserById(request.userId!)

  response.json({ success: true, data: { user } })
}
