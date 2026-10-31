import type { LoginInput, RegisterInput } from '../../types/auth'

export type FormErrors = Partial<Record<keyof RegisterInput, string>>

export function validateLogin(input: LoginInput): FormErrors {
  const errors: FormErrors = {}

  if (!input.email.trim()) errors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (!input.password) errors.password = 'Password is required.'

  return errors
}

export function validateRegister(input: RegisterInput): FormErrors {
  const errors = validateLogin(input)

  if (!input.name.trim()) errors.name = 'Name is required.'
  else if (input.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  if (input.password.length < 8) errors.password = 'Password must be at least 8 characters.'

  return errors
}
