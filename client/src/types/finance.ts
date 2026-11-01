export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  category: string
  description?: string
  date: string
  createdAt: string
  updatedAt: string
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  description?: string
  date: string
}

export interface TransactionFilters {
  type?: TransactionType
  category?: string
  from?: string
  to?: string
  page: number
  limit: number
}

export interface TransactionList {
  items: Transaction[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface Budget {
  id: string
  userId: string
  category: string
  year: number
  month: number
  monthlyLimit: number
  spent: number
  remaining: number
  usagePercentage: number
  createdAt: string
  updatedAt: string
}

export interface Analytics {
  period: { year: number; month: number }
  income: number
  expenses: number
  netSavings: number
  categorySpending: Array<{ category: string; amount: number }>
}
