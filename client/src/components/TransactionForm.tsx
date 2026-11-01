import { useEffect, useState, type FormEvent } from 'react'
import type { Transaction, TransactionInput, TransactionType } from '../types/finance'
import { getApiErrorMessage } from '../utils/apiErrors'

const initialForm: TransactionInput = { type: 'expense', amount: 0, category: '', description: '', date: new Date().toISOString().slice(0, 10) }

export function TransactionForm({ transaction, isSaving, onSubmit, onCancel }: { transaction?: Transaction | null; isSaving: boolean; onSubmit: (input: TransactionInput) => Promise<void>; onCancel?: () => void }) {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(transaction ? { type: transaction.type, amount: transaction.amount, category: transaction.category, description: transaction.description ?? '', date: transaction.date.slice(0, 10) } : initialForm)
    setError('')
  }, [transaction])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.category.trim() || form.amount <= 0 || !form.date) { setError('Enter a positive amount, category, and valid date.'); return }
    setError('')
    try {
      await onSubmit({ ...form, category: form.category.trim(), date: new Date(`${form.date}T00:00:00.000Z`).toISOString() })
      if (!transaction) setForm(initialForm)
    } catch (submitError) { setError(getApiErrorMessage(submitError, 'Could not save this transaction.')) }
  }

  return <form className="transaction-form" onSubmit={handleSubmit}>
    <div className="form-section-heading"><div><span className="eyebrow">{transaction ? 'Update entry' : 'New entry'}</span><h2>{transaction ? 'Edit transaction' : 'Add a transaction'}</h2></div>{transaction && onCancel && <button type="button" className="text-button" onClick={onCancel}>Cancel</button>}</div>
    {error && <div className="server-error" role="alert">{error}</div>}
    <div className="segmented-control">{(['expense', 'income'] as TransactionType[]).map((type) => <button key={type} type="button" className={form.type === type ? 'active' : ''} onClick={() => setForm({ ...form, type })}>{type === 'expense' ? 'Expense' : 'Income'}</button>)}</div>
    <label className="field"><span>Amount</span><input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} placeholder="0.00" /></label>
    <label className="field"><span>Category</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Food, salary, transport..." /></label>
    <label className="field"><span>Description <small>Optional</small></span><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add a note" /></label>
    <label className="field"><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
    <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : transaction ? 'Save changes' : 'Add transaction'}</button>
  </form>
}
