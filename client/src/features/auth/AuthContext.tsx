import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { getCurrentUser, loginUser, registerUser } from '../../api/authApi'
import type { User } from '../../types/auth'
import { AuthContext, saveAuth, TOKEN_KEY, type AuthContextValue } from './AuthContextStore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      return
    }

    getCurrentUser()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      async login(input) {
        saveAuth(await loginUser(input), setUser)
      },
      async register(input) {
        saveAuth(await registerUser(input), setUser)
      },
      updateUser(nextUser) {
        setUser(nextUser)
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY)
        setUser(null)
      },
    }),
    [isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
