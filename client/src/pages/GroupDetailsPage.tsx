import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { createGroupExpense, createGroupSettlement, getGroup, getGroupBalances, getSettlementSuggestions, inviteGroupMember, listGroupExpenses } from '../api/groupApi'
import { StateMessage } from '../components/StateMessage'
import { getApiErrorMessage } from '../utils/apiErrors'
import { formatCurrency } from '../utils/formatters'
import type { Group, GroupBalance, GroupExpense, SuggestedSettlement } from '../types/groups'
import { useAuth } from '../features/auth/useAuth'

export function GroupDetailsPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [expenses, setExpenses] = useState<GroupExpense[]>([])
  const [balances, setBalances] = useState<GroupBalance[]>([])
  const [suggestions, setSuggestions] = useState<SuggestedSettlement[]>([])
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [nextGroup, nextExpenses, nextBalances, nextSuggestions] = await Promise.all([getGroup(id), listGroupExpenses(id), getGroupBalances(id), getSettlementSuggestions(id)])
      setGroup(nextGroup); setExpenses(nextExpenses); setBalances(nextBalances); setSuggestions(nextSuggestions)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load this group.'))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [id])

  async function addExpense(event: React.FormEvent) {
    event.preventDefault()
    if (!group || !title.trim() || Number(amount) <= 0) return
    setSaving(true); setError(''); setMessage('')
    try {
      const expense = await createGroupExpense(id, { title: title.trim(), amountMinor: Math.round(Number(amount) * 100), currency: 'INR', category: 'Other', date: new Date().toISOString(), payerId: user!.id, participants: group.members.map((member) => ({ userId: member.userId })), splitMethod: 'equal' })
      setExpenses((current) => [expense, ...current]); setTitle(''); setAmount(''); setMessage('Expense added.')
      const [nextBalances, nextSuggestions] = await Promise.all([getGroupBalances(id), getSettlementSuggestions(id)])
      setBalances(nextBalances); setSuggestions(nextSuggestions)
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not add the expense.')) } finally { setSaving(false) }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true); setError('')
    try { await inviteGroupMember(id, email); setEmail(''); setMessage('Invitation sent.') } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not send the invitation.')) } finally { setSaving(false) }
  }

  async function settle(suggestion: SuggestedSettlement) {
    setSaving(true); setError('')
    try { await createGroupSettlement(id, suggestion); setSuggestions((current) => current.filter((item) => item !== suggestion)); setBalances(await getGroupBalances(id)); setMessage('Settlement recorded.'); } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not record the settlement.')) } finally { setSaving(false) }
  }

  if (loading) return <div className="content-page"><StateMessage kind="loading">Loading group...</StateMessage></div>
  if (error && !group) return <div className="content-page"><StateMessage kind="error">{error}</StateMessage><Link to="/groups" className="secondary-button">Back to groups</Link></div>
  if (!group) return null

  return <div className="content-page">
    <header className="page-header"><div><Link to="/groups" className="back-link">← All groups</Link><span className="eyebrow">{group.type}</span><h1>{group.name}</h1><p>{group.description || 'Shared expenses and balances.'}</p></div></header>
    {error && <StateMessage kind="error">{error}</StateMessage>}{message && <div className="success-message">{message}</div>}
    <div className="group-detail-grid">
      <section className="panel form-stack"><div className="form-section-heading"><div><span className="eyebrow">Add expense</span><h2>Record a shared bill</h2></div></div><form className="form-stack" onSubmit={addExpense}><div className="field"><label htmlFor="expense-title">Title</label><input id="expense-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Dinner" required /></div><div className="field"><label htmlFor="expense-amount">Amount (₹)</label><input id="expense-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><p className="form-help">This MVP uses an equal split among all current members. More split methods are available through the API.</p><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add expense'}</button></form></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Balances</span><h2>Who owes what</h2></div></div>{balances.map((balance) => <div className="balance-row" key={balance.userId}><span>{balance.userId === user?.id ? 'You' : balance.userId}</span><strong className={balance.amountMinor >= 0 ? 'amount-positive' : 'amount-negative'}>{balance.amountMinor >= 0 ? 'owed ' : 'owes '}{formatCurrency(Math.abs(balance.amountMinor) / 100)}</strong></div>)}{!balances.some((balance) => balance.amountMinor !== 0) && <StateMessage kind="empty">Everyone is settled up.</StateMessage>}</section>
    </div>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Settle up</span><h2>Suggested payments</h2></div></div>{suggestions.length ? suggestions.map((suggestion) => <div className="settlement-row" key={`${suggestion.payerId}-${suggestion.recipientId}`}><span>{suggestion.payerId === user?.id ? 'You' : suggestion.payerId} → {suggestion.recipientId === user?.id ? 'you' : suggestion.recipientId}</span><strong>{formatCurrency(suggestion.amountMinor / 100)}</strong><button className="secondary-button" type="button" disabled={saving || suggestion.payerId !== user?.id} onClick={() => void settle(suggestion)}>Record payment</button></div>) : <StateMessage kind="empty">No settlement payments are suggested.</StateMessage>}</section>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Expense history</span><h2>Recent shared expenses</h2></div></div>{expenses.length ? expenses.map((expense) => <div className="expense-row" key={expense.id}><div><strong>{expense.title}</strong><span>{expense.category} · paid by {expense.payerId === user?.id ? 'you' : expense.payerId}</span></div><strong>{formatCurrency(expense.amountMinor / 100)}</strong></div>) : <StateMessage kind="empty">No expenses recorded yet.</StateMessage>}</section>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Members</span><h2>{group.members.length} members</h2></div></div>{group.members.map((member) => <div className="member-row" key={member.userId}><span>{member.userId === user?.id ? 'You' : member.userId}</span><small>{member.role}</small></div>)}<form className="inline-form" onSubmit={invite}><input type="email" placeholder="registered-user@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="secondary-button" type="submit" disabled={saving}>Invite</button></form></section>
  </div>
}
