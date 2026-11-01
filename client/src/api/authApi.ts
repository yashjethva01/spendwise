import apiClient from './client'
import type { AuthResponse, LoginInput, PasswordChangeInput, ProfileUpdateInput, RegisterInput, User } from '../types/auth'

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiClient.post<{ data: AuthResponse }>('/auth/register', input)
  return response.data.data
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const response = await apiClient.post<{ data: AuthResponse }>('/auth/login', input)
  return response.data.data
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<{ data: { user: User } }>('/auth/me')
  return response.data.data.user
}

export async function updateProfile(input: ProfileUpdateInput): Promise<User> {
  const response = await apiClient.patch<{ data: { user: User } }>('/auth/me', input)
  return response.data.data.user
}

export async function changePassword(input: PasswordChangeInput): Promise<void> {
  await apiClient.post('/auth/me/password', input)
}
