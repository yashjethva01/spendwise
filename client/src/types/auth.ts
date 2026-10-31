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
