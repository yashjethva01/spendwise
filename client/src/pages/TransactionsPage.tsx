import { useCallback, useEffect, useState } from 'react'
import { createTransaction, listTransactions, removeTransaction, updateTransaction } from '../api/financeApi'
import { StateMessage } from '../components/StateMessage'
import { TransactionForm } from '../components/TransactionForm'
import { getApiErrorMessage } from '../utils/apiErrors'
import { formatCurrency, formatDate } from '../utils/formatters'
import type { Transaction, TransactionFilters, TransactionInput, TransactionType } from '../types/finance'

const initialFilters: TransactionFilters = { page: 1, limit: 10 }

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState(initialFilters)
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const result = await listTransactions(filters); setTransactions(result.items); setPagination(result.pagination) }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not load transactions.')) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { void load() }, [load])

  async function save(input: TransactionInput) {
    setSaving(true)
    try { if (editing) await updateTransaction(editing.id, input); else await createTransaction(input); setEditing(null); setSuccess(editing ? 'Transaction updated.' : 'Transaction added.'); await load() }
    catch (requestError) { throw new Error(getApiErrorMessage(requestError, 'Could not save transaction.')) }
    finally { setSaving(false) }
  }

  async function remove(transaction: Transaction) {
    if (!window.confirm(`Delete the ${transaction.category} transaction of ${formatCurrency(transaction.amount)}?`)) return
    try { await removeTransaction(transaction.id); setSuccess('Transaction deleted.'); await load() }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not delete transaction.')) }
  }

  function filter<Key extends keyof TransactionFilters>(key: Key, value: TransactionFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  return <div className="content-page">
    <header className="page-header"><div><span className="eyebrow">Your ledger</span><h1>Transactions</h1><p>Keep every income and expense in one trustworthy place.</p></div></header>
    <div className="workspace-grid">
      <section className="panel transaction-list-panel"><div className="panel-heading"><div><span className="eyebrow">Activity</span><h2>Recent transactions</h2></div><span className="result-count">{pagination.total} total</span></div>
        <div className="filter-bar"><input aria-label="Filter by category" placeholder="Search category" value={category} onChange={(event) => setCategory(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') filter('category', category) }} /><select aria-label="Filter by type" value={filters.type ?? ''} onChange={(event) => filter('type', (event.target.value || undefined) as TransactionType | undefined)}><option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select><input aria-label="Filter from date" type="date" value={filters.from ?? ''} onChange={(event) => filter('from', event.target.value || undefined)} /><input aria-label="Filter to date" type="date" value={filters.to ?? ''} onChange={(event) => filter('to', event.target.value || undefined)} /></div>
        {success && <div className="success-message" role="status">{success}</div>}{error && <StateMessage kind="error">{error}</StateMessage>}
        {loading ? <StateMessage kind="loading">Loading transactions...</StateMessage> : transactions.length ? <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th className="amount-column">Amount</th><th /></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td><strong>{transaction.description || transaction.category}</strong><span className={`type-dot ${transaction.type}`}>{transaction.type}</span></td><td>{transaction.category}</td><td>{formatDate(transaction.date)}</td><td className={`amount-column ${transaction.type}`}>{transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}</td><td className="actions"><button type="button" className="text-button" onClick={() => setEditing(transaction)}>Edit</button><button type="button" className="danger-button" onClick={() => void remove(transaction)}>Delete</button></td></tr>)}</tbody></table></div> : <StateMessage kind="empty">No transactions match these filters.</StateMessage>}
        {pagination.totalPages > 1 && <div className="pagination"><button type="button" className="secondary-button" disabled={pagination.page <= 1} onClick={() => filter('page', pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" className="secondary-button" disabled={pagination.page >= pagination.totalPages} onClick={() => filter('page', pagination.page + 1)}>Next</button></div>}
      </section>
      <section className="panel"><TransactionForm transaction={editing} isSaving={saving} onSubmit={save} onCancel={() => setEditing(null)} /></section>
    </div>
  </div>
}
