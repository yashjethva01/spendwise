import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72),
}).refine((input) => input.newPassword === input.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>
