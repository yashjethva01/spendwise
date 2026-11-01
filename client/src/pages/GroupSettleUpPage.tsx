import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { createGroupSettlement, getGroup, getMyGroupBalance, getSettlementSuggestions, listGroupSettlements } from '../api/groupApi'
import { StateMessage } from '../components/StateMessage'
import { useAuth } from '../features/auth/useAuth'
import type { Group, GroupSettlement, SuggestedSettlement } from '../types/groups'
import { getApiErrorMessage } from '../utils/apiErrors'
import { formatCurrency } from '../utils/formatters'

export function GroupSettleUpPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [balance, setBalance] = useState<Awaited<ReturnType<typeof getMyGroupBalance>> | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedSettlement[]>([])
  const [history, setHistory] = useState<GroupSettlement[]>([])
  const [pending, setPending] = useState<SuggestedSettlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    try {
      const [nextGroup, nextBalance, nextSuggestions, nextHistory] = await Promise.all([getGroup(id), getMyGroupBalance(id), getSettlementSuggestions(id), listGroupSettlements(id)])
      setGroup(nextGroup); setBalance(nextBalance); setSuggestions(nextSuggestions); setHistory(nextHistory)
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not load settlement details.')) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  async function record(suggestion: SuggestedSettlement) {
    setSaving(true); setError('')
    try {
      await createGroupSettlement(id, { payerId: suggestion.payerId, recipientId: suggestion.recipientId, amountMinor: suggestion.amountMinor, idempotencyKey: crypto.randomUUID() })
      await load(); setPending(null); setMessage('Settlement recorded.')
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not record this settlement.')) } finally { setSaving(false) }
  }
  if (loading) return <div className="content-page"><StateMessage kind="loading">Loading settlement details...</StateMessage></div>
  if (!group || !balance) return <div className="content-page"><StateMessage kind="error">{error || 'Settlement details unavailable.'}</StateMessage></div>
  return <div className="content-page">
    <header className="page-header"><div><Link to={`/groups/${id}`} className="back-link">← {group.name}</Link><span className="eyebrow">Settlement</span><h1>Settle up</h1><p>Record only an explicit payment action. SpendWise does not transfer money.</p></div></header>
    {error && <StateMessage kind="error">{error}</StateMessage>}{message && <div className="success-message">{message}</div>}
    <section className="panel net-balance-card">
      <div><span className="eyebrow">Your net balance</span><h2>{balance.netMinor === 0 ? 'All settled up' : balance.netMinor > 0 ? 'You are owed' : 'You owe'}</h2><p>{balance.netMinor === 0 ? 'You have no outstanding balance in this group.' : balance.netMinor > 0 ? 'This is the amount others owe you.' : 'This is the amount you owe in this group.'}</p></div>
      <strong className={balance.netMinor > 0 ? 'amount-positive' : balance.netMinor < 0 ? 'amount-negative' : ''}>{balance.netMinor === 0 ? formatCurrency(0) : `${balance.netMinor < 0 ? '-' : ''}${formatCurrency(Math.abs(balance.netMinor) / 100)}`}</strong>
    </section>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Suggested payments</span><h2>Your settlement actions</h2></div></div>{suggestions.length ? suggestions.map((suggestion) => <div className="settlement-row" key={`${suggestion.payerId}-${suggestion.recipientId}`}><span>{suggestion.payerId === user?.id ? 'You' : suggestion.payerName} → {suggestion.recipientId === user?.id ? 'You' : suggestion.recipientName}<small>{suggestion.payerId === user?.id ? 'You owe this amount' : 'Amount to collect'}</small></span><strong>{formatCurrency(suggestion.amountMinor / 100)}</strong><button className="secondary-button" type="button" disabled={saving} onClick={() => setPending(suggestion)}>{suggestion.payerId === user?.id ? 'Record payment' : 'Record received payment'}</button></div>) : <StateMessage kind="empty">You're all settled up!<br />You have no payments to make or collect in this group.</StateMessage>}</section>
    <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">History</span><h2>Settlement history</h2></div></div>{history.length ? history.map((settlement) => <div className="settlement-row" key={settlement.id}><span>Paid by {settlement.payerId === user?.id ? 'You' : settlement.payerName} to {settlement.recipientId === user?.id ? 'You' : settlement.recipientName}<small>{new Date(settlement.createdAt).toLocaleString()} · {settlement.status}</small></span><strong>{formatCurrency(settlement.amountMinor / 100)}</strong></div>) : <StateMessage kind="empty">No settlements recorded yet.</StateMessage>}</section>
    {pending && <div className="modal-backdrop" role="presentation"><section className="confirmation-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-settlement"><h2 id="confirm-settlement">Confirm settlement</h2><p>{pending.payerId === user?.id ? 'You' : pending.payerName} will be recorded as paying {pending.recipientId === user?.id ? 'you' : pending.recipientName} {formatCurrency(pending.amountMinor / 100)}.</p><div className="invitation-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setPending(null)}>Cancel</button><button className="primary-button" type="button" disabled={saving} onClick={() => void record(pending)}>{saving ? 'Saving...' : 'Confirm record'}</button></div></section></div>}
  </div>
}
