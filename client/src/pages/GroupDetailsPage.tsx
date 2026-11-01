import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { createGroupExpense, getGroup, getMyGroupBalance, listGroupExpenses } from '../api/groupApi'
import { StateMessage } from '../components/StateMessage'
import { useAuth } from '../features/auth/useAuth'
import type { Group, GroupExpense, SplitMethod } from '../types/groups'
import { getApiErrorMessage } from '../utils/apiErrors'
import { formatCurrency } from '../utils/formatters'
import { getExpenseRelationship } from '../utils/groupExpensePresentation'

function UsersIcon() {
  return <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="3" />
    <circle cx="5" cy="9" r="2" />
    <circle cx="19" cy="9" r="2" />
    <path d="M6 20v-1a6 6 0 0 1 12 0v1M2 19v-1a3 3 0 0 1 4-2.83M22 19v-1a3 3 0 0 0-4-2.83" />
  </svg>
}

type SplitValues = Record<string, string>
const initialExpenseDate = new Date().toISOString().slice(0, 10)

function calculatePreview(amountMinor: number, method: SplitMethod, participantIds: string[], values: SplitValues) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return { shares: [], error: 'Enter an amount greater than zero.' }
  if (!participantIds.length) return { shares: [], error: 'Select at least one participant.' }
  if (method === 'equal') {
    const base = Math.floor(amountMinor / participantIds.length)
    const remainder = amountMinor % participantIds.length
    return { shares: participantIds.map((userId, index) => ({ userId, amountMinor: base + (index < remainder ? 1 : 0) })), error: '' }
  }
  const parsed = participantIds.map((userId) => ({ userId, value: Number(values[userId] ?? '') }))
  if (parsed.some((item) => !Number.isFinite(item.value) || item.value < 0)) {
    return { shares: [], error: method === 'exact' ? 'Enter a valid non-negative amount for every participant.' : 'Enter a valid non-negative percentage for every participant.' }
  }
  if (method === 'exact') {
    const shares = parsed.map(({ userId, value }) => ({ userId, amountMinor: Math.round(value * 100) }))
    return { shares, error: shares.reduce((sum, share) => sum + share.amountMinor, 0) === amountMinor ? '' : 'Exact shares must add up to the total amount.' }
  }
  const totalPercentage = parsed.reduce((sum, item) => sum + item.value, 0)
  if (Math.abs(totalPercentage - 100) > 0.000001) return { shares: [], error: `Percentages must total 100% (currently ${totalPercentage.toFixed(2)}%).` }
  const calculated = parsed.map(({ userId, value }) => {
    const exact = (amountMinor * value) / 100
    const floor = Math.floor(exact)
    return { userId, amountMinor: floor, remainder: exact - floor }
  })
  let remainder = amountMinor - calculated.reduce((sum, item) => sum + item.amountMinor, 0)
  calculated.sort((left, right) => right.remainder - left.remainder).forEach((item) => {
    if (remainder > 0) { item.amountMinor += 1; remainder -= 1 }
  })
  return { shares: calculated.map(({ userId, amountMinor }) => ({ userId, amountMinor })), error: remainder === 0 ? '' : 'The percentage split could not be rounded safely.' }
}

export function GroupDetailsPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [expenses, setExpenses] = useState<GroupExpense[]>([])
  const [balanceSummary, setBalanceSummary] = useState<Awaited<ReturnType<typeof getMyGroupBalance>> | null>(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Other')
  const [date, setDate] = useState(initialExpenseDate)
  const [payerId, setPayerId] = useState('')
  const [method, setMethod] = useState<SplitMethod>('equal')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [values, setValues] = useState<SplitValues>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextGroup, nextExpenses, nextBalance] = await Promise.all([getGroup(id), listGroupExpenses(id), getMyGroupBalance(id)])
      setGroup(nextGroup); setExpenses(nextExpenses); setBalanceSummary(nextBalance)
      setPayerId((current) => current || user?.id || nextGroup.members[0]?.userId || '')
      setParticipantIds((current) => current.length ? current : nextGroup.members.map((member) => member.userId))
      setError('')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load this group.'))
    } finally { setLoading(false) }
  }, [id, user?.id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!showExpenseForm) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setShowExpenseForm(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showExpenseForm, saving])

  const amountMinor = Math.round(Number(amount) * 100)
  const preview = useMemo(() => calculatePreview(amountMinor, method, participantIds, values), [amountMinor, method, participantIds, values])

  async function addExpense(event: FormEvent) {
    event.preventDefault()
    if (!group || !title.trim() || preview.error || !preview.shares.length) return
    setSaving(true); setError('')
    try {
      const expense = await createGroupExpense(id, {
        title: title.trim(), amountMinor, currency: 'INR', category,
        date: new Date(`${date}T00:00:00`).toISOString(), payerId,
        participants: participantIds.map((participantId) => ({
          userId: participantId,
          ...(method === 'exact' ? { value: Math.round(Number(values[participantId]) * 100) } : method === 'percentage' ? { value: Number(values[participantId]) } : {}),
        })),
        splitMethod: method,
      })
      setExpenses((current) => [expense, ...current]); setTitle(''); setAmount(''); setValues({})
      setMessage('Expense added.'); setShowExpenseForm(false)
      setBalanceSummary(await getMyGroupBalance(id))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not add the expense.'))
    } finally { setSaving(false) }
  }

  if (loading) return <div className="content-page"><StateMessage kind="loading">Loading group...</StateMessage></div>
  if (error && !group) return <div className="content-page"><StateMessage kind="error">{error}</StateMessage><Link to="/groups" className="secondary-button">Back to groups</Link></div>
  if (!group || !balanceSummary) return null

  return <div className="content-page">
    <header className="page-header">
      <div><Link to="/groups" className="back-link">← Group expenses</Link><span className="eyebrow">{group.type} · {group.members.length} members</span><h1>{group.name}</h1><p>{group.description || 'Shared expenses and balances.'}</p></div>
      <div className="header-actions"><button className="primary-button" type="button" onClick={() => setShowExpenseForm(true)}>＋ Add expense</button><Link className="secondary-button" to={`/groups/${id}/settle-up`}>⇄ Settle up</Link><Link aria-label={`View ${group.members.length} group members`} className="secondary-button icon-label" to={`/groups/${id}/members`}><UsersIcon /> Members · {group.members.length}</Link></div>
    </header>
    {error && <StateMessage kind="error">{error}</StateMessage>}{message && <div className="success-message">{message}</div>}
    <section className="panel net-balance-card">
      <div><span className="eyebrow">Your net balance</span><h2>{balanceSummary.netMinor === 0 ? 'All settled up' : balanceSummary.netMinor > 0 ? 'You are owed' : 'You owe'}</h2><p>{balanceSummary.netMinor === 0 ? 'You have no outstanding balance in this group.' : balanceSummary.netMinor > 0 ? 'This is the amount others owe you.' : 'This is the amount you owe in this group.'}</p></div>
      <strong className={balanceSummary.netMinor > 0 ? 'amount-positive' : balanceSummary.netMinor < 0 ? 'amount-negative' : ''}>{balanceSummary.netMinor === 0 ? formatCurrency(0) : `${balanceSummary.netMinor < 0 ? '-' : ''}${formatCurrency(Math.abs(balanceSummary.netMinor) / 100)}`}</strong>
    </section>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Personal balances</span><h2>Who owes what</h2></div></div>{!balanceSummary.owes.length && !balanceSummary.owedToYou.length ? <StateMessage kind="empty">You're all settled up!</StateMessage> : <>{balanceSummary.owes.map((item) => <div className="balance-row" key={`owe-${item.userId}`}><span>You owe {item.name}</span><strong className="amount-negative">{formatCurrency(item.amountMinor / 100)}</strong></div>)}{balanceSummary.owedToYou.map((item) => <div className="balance-row" key={`owed-${item.userId}`}><span>{item.name} owes you</span><strong className="amount-positive">{formatCurrency(item.amountMinor / 100)}</strong></div>)}</>}</section>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Shared expenses</h2></div><Link className="text-button" to={`/groups/${id}/expenses`}>View all expenses</Link></div>{expenses.slice(0, 5).map((expense) => { const relationship = getExpenseRelationship(expense, user?.id); return <div className="expense-row" key={expense.id}><div><strong>{expense.title}</strong><span>{expense.category} · {relationship.isPayer ? 'You paid' : `${expense.payerName} paid`} {formatCurrency(expense.amountMinor / 100)}</span><small>{new Date(expense.date).toLocaleDateString()} · {expense.splitMethod} split · {relationship.isParticipant ? `Your share ${formatCurrency(relationship.share!.amountMinor / 100)}` : 'You are not involved'}</small></div><strong>{formatCurrency(expense.amountMinor / 100)}</strong></div> })}{!expenses.length && <StateMessage kind="empty">No shared expenses recorded yet.</StateMessage>}</section>
    {showExpenseForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowExpenseForm(false) }}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-expense-title"><div className="form-section-heading"><div><span className="eyebrow">New expense</span><h2 id="add-expense-title">Record a shared bill</h2></div><button className="icon-button modal-close" type="button" onClick={() => setShowExpenseForm(false)} disabled={saving} aria-label="Close add expense form">×</button></div><form className="form-stack" onSubmit={addExpense}><div className="field"><label htmlFor="expense-title">Title</label><input id="expense-title" value={title} onChange={(event) => setTitle(event.target.value)} required /></div><div className="field"><label htmlFor="expense-amount">Amount (₹)</label><input id="expense-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><div className="field"><label htmlFor="expense-category">Category</label><select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value)}>{['Food', 'Groceries', 'Rent', 'Travel', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="expense-date">Date</label><input id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><div className="field"><label htmlFor="expense-payer">Paid by</label><select id="expense-payer" value={payerId} onChange={(event) => setPayerId(event.target.value)}>{group.members.map((member) => <option value={member.userId} key={member.userId}>{member.userId === user?.id ? 'You' : member.name}</option>)}</select></div><fieldset className="participant-fieldset"><legend>Participants</legend>{group.members.map((member) => <label className="participant-option" key={member.userId}><input type="checkbox" checked={participantIds.includes(member.userId)} onChange={() => setParticipantIds((current) => current.includes(member.userId) ? current.filter((value) => value !== member.userId) : [...current, member.userId])} />{member.userId === user?.id ? 'You' : member.name}</label>)}</fieldset><div className="field"><label htmlFor="split-method">Split method</label><select id="split-method" value={method} onChange={(event) => { setMethod(event.target.value as SplitMethod); setValues({}) }}><option value="equal">Equal split</option><option value="exact">Exact amounts</option><option value="percentage">Percentages</option></select></div>{method !== 'equal' && <div className="split-inputs">{participantIds.map((participantId) => <div className="split-input-row" key={participantId}><label htmlFor={`split-${participantId}`}>{group.members.find((member) => member.userId === participantId)?.name ?? 'Unknown member'}</label><input id={`split-${participantId}`} type="number" min="0" step="0.01" value={values[participantId] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [participantId]: event.target.value }))} /><span>{method === 'exact' ? '₹' : '%'}</span></div>)}</div>}{preview.shares.length > 0 && <div className="split-preview"><strong>Share preview</strong>{preview.shares.map((share) => <div className="split-preview-row" key={share.userId}><span>{group.members.find((member) => member.userId === share.userId)?.name ?? 'Unknown member'}</span><span>{formatCurrency(share.amountMinor / 100)}</span></div>)}</div>}{preview.error && <p className="field-error">{preview.error}</p>}<button className="primary-button" type="submit" disabled={saving || Boolean(preview.error)}>{saving ? 'Saving...' : 'Add expense'}</button></form></section></div>}
  </div>
}
