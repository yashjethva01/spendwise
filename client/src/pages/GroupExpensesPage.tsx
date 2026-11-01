import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getGroup, listGroupExpenses } from '../api/groupApi'
import { StateMessage } from '../components/StateMessage'
import type { Group, GroupExpense } from '../types/groups'
import { getApiErrorMessage } from '../utils/apiErrors'
import { formatCurrency } from '../utils/formatters'
import { getExpenseRelationship } from '../utils/groupExpensePresentation'
import { useAuth } from '../features/auth/useAuth'

export function GroupExpensesPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [expenses, setExpenses] = useState<GroupExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const [nextGroup, nextExpenses] = await Promise.all([getGroup(id), listGroupExpenses(id)]); setGroup(nextGroup); setExpenses(nextExpenses) }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not load expenses.')) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  if (loading) return <div className="content-page"><StateMessage kind="loading">Loading expenses...</StateMessage></div>
  if (!group) return <div className="content-page"><StateMessage kind="error">{error || 'Group not found.'}</StateMessage></div>
  return <div className="content-page"><header className="page-header"><div><Link to={`/groups/${id}`} className="back-link">← {group.name}</Link><span className="eyebrow">Group expenses</span><h1>All shared expenses</h1><p>Review every expense recorded in this group.</p></div></header>{error && <StateMessage kind="error">{error}</StateMessage>}<section className="panel group-section">{expenses.length ? expenses.map((expense) => { const relationship = getExpenseRelationship(expense, user?.id); return <div className="expense-row" key={expense.id}><div><strong>{expense.title}</strong><span>{expense.category} · {relationship.isPayer ? 'You paid' : `${expense.payerName} paid`} {formatCurrency(expense.amountMinor / 100)}</span><small>{new Date(expense.date).toLocaleDateString()} · {expense.splitMethod} split · {relationship.isParticipant ? `Your share ${formatCurrency(relationship.share!.amountMinor / 100)}` : 'You are not involved'}</small></div><strong>{formatCurrency(expense.amountMinor / 100)}</strong></div> }) : <StateMessage kind="empty">No shared expenses recorded yet.</StateMessage>}</section></div>
}
