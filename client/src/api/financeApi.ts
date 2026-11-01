import apiClient from './client'
import type { Analytics, Budget, Transaction, TransactionFilters, TransactionInput, TransactionList } from '../types/finance'

function queryParams(params: object) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function getMonthlyAnalytics(year: number, month: number) {
  const response = await apiClient.get<{ data: Analytics }>('/analytics/monthly', { params: { year, month } })
  return response.data.data
}

export async function getBudgets(year: number, month: number) {
  const response = await apiClient.get<{ data: { budgets: Budget[] } }>('/budgets', { params: { year, month } })
  return response.data.data.budgets
}

export async function createBudget(input: {
  category: string
  year: number
  month: number
  monthlyLimit: number
}) {
  const response = await apiClient.post<{ data: { budget: Budget } }>('/budgets', input)
  return response.data.data.budget
}

export async function updateBudget(
  id: string,
  input: Partial<{ category: string; year: number; month: number; monthlyLimit: number }>,
) {
  const response = await apiClient.patch<{ data: { budget: Budget } }>(`/budgets/${id}`, input)
  return response.data.data.budget
}

export async function removeBudget(id: string) {
  await apiClient.delete(`/budgets/${id}`)
}

export async function listTransactions(filters: TransactionFilters) {
  const response = await apiClient.get<{ data: TransactionList }>('/transactions', { params: queryParams(filters) })
  return response.data.data
}

export async function createTransaction(input: TransactionInput) {
  const response = await apiClient.post<{ data: { transaction: Transaction } }>('/transactions', input)
  return response.data.data.transaction
}

export async function updateTransaction(id: string, input: Partial<TransactionInput>) {
  const response = await apiClient.patch<{ data: { transaction: Transaction } }>(`/transactions/${id}`, input)
  return response.data.data.transaction
}

export async function removeTransaction(id: string) {
  await apiClient.delete(`/transactions/${id}`)
}
