import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { createBudget, getBudgets, removeBudget, updateBudget } from '../api/financeApi'
import { PeriodPicker } from '../components/PeriodPicker'
import { StateMessage } from '../components/StateMessage'
import { getApiErrorMessage } from '../utils/apiErrors'
import { currentPeriod, formatCurrency, monthLabel } from '../utils/formatters'
import type { Budget } from '../types/finance'

interface BudgetFormValues {
  category: string
  monthlyLimit: string
}

const emptyForm: BudgetFormValues = { category: '', monthlyLimit: '' }

export function BudgetsPage() {
  const [period, setPeriod] = useState(useMemo(() => currentPeriod(), []))
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [form, setForm] = useState<BudgetFormValues>(emptyForm)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const loadBudgets = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setBudgets(await getBudgets(period.year, period.month))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load budgets.'))
    } finally {
      setIsLoading(false)
    }
  }, [period])

  useEffect(() => {
    void loadBudgets()
  }, [loadBudgets])

  function startEditing(budget: Budget) {
    setEditing(budget)
    setForm({ category: budget.category, monthlyLimit: String(budget.monthlyLimit) })
    setFormError('')
    setSuccess('')
  }

  function resetForm() {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const category = form.category.trim()
    const monthlyLimit = Number(form.monthlyLimit)

    if (!category || !Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
      setFormError('Enter a category and a monthly limit greater than zero.')
      return
    }

    setIsSaving(true)
    setFormError('')
    setSuccess('')
    try {
      if (editing) {
        await updateBudget(editing.id, { category, monthlyLimit })
        setSuccess('Budget updated.')
      } else {
        await createBudget({ category, monthlyLimit, ...period })
        setSuccess('Budget created.')
      }
      resetForm()
      await loadBudgets()
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, 'Could not save this budget.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(budget: Budget) {
    if (!window.confirm(`Delete the ${budget.category} budget for ${monthLabel(budget.year, budget.month)}?`)) {
      return
    }

    setError('')
    setSuccess('')
    try {
      await removeBudget(budget.id)
      setSuccess('Budget deleted.')
      if (editing?.id === budget.id) resetForm()
      await loadBudgets()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not delete this budget.'))
    }
  }

  return (
    <div className="content-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Plan with intention</span>
          <h1>Budgets</h1>
          <p>Set category limits and keep your monthly spending aligned.</p>
        </div>
        <PeriodPicker
          year={period.year}
          month={period.month}
          onChange={(year, month) => {
            setPeriod({ year, month })
            resetForm()
          }}
        />
      </header>

      <div className="budget-page-grid">
        <section className="panel budget-list-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{monthLabel(period.year, period.month)}</span>
              <h2>Category budgets</h2>
            </div>
            <span className="result-count">{budgets.length} set</span>
          </div>
          {success && <div className="success-message" role="status">{success}</div>}
          {error && <StateMessage kind="error">{error}</StateMessage>}
          {isLoading ? (
            <StateMessage kind="loading">Loading budgets...</StateMessage>
          ) : budgets.length ? (
            <div className="budget-card-list">
              {budgets.map((budget) => {
                const isOverBudget = budget.remaining < 0 || budget.usagePercentage > 100
                const progressWidth = Math.min(Math.max(budget.usagePercentage, 0), 100)
                return (
                  <article className={`budget-card ${isOverBudget ? 'budget-card-over' : ''}`} key={budget.id}>
                    <div className="budget-card-header">
                      <div>
                        <h3>{budget.category}</h3>
                        <span>{formatCurrency(budget.spent)} spent of {formatCurrency(budget.monthlyLimit)}</span>
                      </div>
                      <strong>{Math.round(Math.max(budget.usagePercentage, 0))}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${isOverBudget ? 'over-budget' : ''}`} style={{ width: `${progressWidth}%` }} />
                    </div>
                    <div className="budget-card-footer">
                      <span className={isOverBudget ? 'overspending-label' : ''}>
                        {isOverBudget
                          ? `Over budget by ${formatCurrency(Math.abs(budget.remaining))}`
                          : `${formatCurrency(Math.max(budget.remaining, 0))} remaining`}
                      </span>
                      <div>
                        <button type="button" className="text-button" onClick={() => startEditing(budget)}>Edit</button>
                        <button type="button" className="danger-button" onClick={() => void handleDelete(budget)}>Delete</button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <StateMessage kind="empty">No budgets set for {monthLabel(period.year, period.month)}. Add your first category limit.</StateMessage>
          )}
        </section>

        <section className="panel budget-form-panel">
          <div className="form-section-heading">
            <div>
              <span className="eyebrow">{editing ? 'Update limit' : 'New limit'}</span>
              <h2>{editing ? 'Edit budget' : 'Add a budget'}</h2>
            </div>
            {editing && <button type="button" className="text-button" onClick={resetForm}>Cancel</button>}
          </div>
          <p className="form-help">
            Budgeting for <strong>{monthLabel(period.year, period.month)}</strong>. Spending is calculated by the server from your expense transactions.
          </p>
          <form className="transaction-form" onSubmit={handleSubmit} noValidate>
            {formError && <div className="server-error" role="alert">{formError}</div>}
            <label className="field">
              <span>Category</span>
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Food, rent, transport..." />
            </label>
            <label className="field">
              <span>Monthly limit</span>
              <input type="number" min="0.01" step="0.01" value={form.monthlyLimit} onChange={(event) => setForm({ ...form, monthlyLimit: event.target.value })} placeholder="0.00" />
            </label>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Create budget'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
