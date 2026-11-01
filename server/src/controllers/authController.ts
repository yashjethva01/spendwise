import type { Request, Response } from 'express'

import { changeUserPassword, getUserById, loginUser, registerUser, updateUserProfile } from '../services/authService.js'
import { loginSchema, passwordChangeSchema, profileUpdateSchema, registerSchema } from '../validators/authValidators.js'

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

export async function updateProfile(request: Request, response: Response): Promise<void> {
  const input = profileUpdateSchema.parse(request.body)
  const user = await updateUserProfile(request.userId!, input)
  response.json({ success: true, data: { user } })
}

export async function changePassword(request: Request, response: Response): Promise<void> {
  const input = passwordChangeSchema.parse(request.body)
  await changeUserPassword(request.userId!, input)
  response.json({ success: true, data: { message: 'Password updated successfully.' } })
}
