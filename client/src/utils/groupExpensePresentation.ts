import type { GroupExpense } from '../types/groups'

export function getExpenseUserShare(expense: GroupExpense, userId: string | undefined) {
  if (!userId) return undefined
  return expense.shares?.find((share) => String(share.userId) === String(userId))
}

export function getExpenseRelationship(expense: GroupExpense, userId: string | undefined) {
  const isPayer = Boolean(userId) && String(expense.payerId) === String(userId)
  const share = getExpenseUserShare(expense, userId)
  return {
    isPayer,
    isParticipant: Boolean(share),
    share,
  }
}
