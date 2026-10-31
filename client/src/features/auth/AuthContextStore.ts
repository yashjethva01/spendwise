import { createContext } from 'react'

import type { AuthResponse, LoginInput, RegisterInput, User } from '../../types/auth'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const TOKEN_KEY = 'spendwise_token'

export function saveAuth(
  result: AuthResponse,
  setUser: (user: User) => void,
) {
  localStorage.setItem(TOKEN_KEY, result.token)
  setUser(result.user)
}
