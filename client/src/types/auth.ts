export interface User {
  id: string
  name: string
  email: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  name: string
}

export interface ProfileUpdateInput {
  name: string
  email: string
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
