import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getBudgets, getMonthlyAnalytics } from '../api/financeApi'
import { MetricCard } from '../components/MetricCard'
import { PeriodPicker } from '../components/PeriodPicker'
import { StateMessage } from '../components/StateMessage'
import { SpendingInsightPanel } from '../components/SpendingInsightPanel'
import { getApiErrorMessage } from '../utils/apiErrors'
import { currentPeriod, formatCurrency, monthLabel } from '../utils/formatters'
import type { Analytics, Budget } from '../types/finance'

const colors = ['#3767d6', '#e89a45', '#46a67c', '#9c6ade', '#ef6a62', '#70819e']

export function DashboardPage() {
  const [period, setPeriod] = useState(useMemo(() => currentPeriod(), []))
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    Promise.all([getMonthlyAnalytics(period.year, period.month), getBudgets(period.year, period.month)])
      .then(([nextAnalytics, nextBudgets]) => { if (active) { setAnalytics(nextAnalytics); setBudgets(nextBudgets) } })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Could not load your financial overview.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  const totals = budgets.reduce((result, budget) => ({ limit: result.limit + budget.monthlyLimit, spent: result.spent + budget.spent }), { limit: 0, spent: 0 })
  const percentage = totals.limit ? (totals.spent / totals.limit) * 100 : 0

  return <div className="content-page">
    <header className="page-header"><div><span className="eyebrow">Financial overview</span><h1>Good morning.</h1><p>Here is your money story for {monthLabel(period.year, period.month)}.</p></div><PeriodPicker year={period.year} month={period.month} onChange={(year, month) => setPeriod({ year, month })} /></header>
    {loading && <StateMessage kind="loading">Loading your financial overview...</StateMessage>}
    {error && <StateMessage kind="error">{error}</StateMessage>}
    {!loading && !error && analytics && <div className="dashboard-stack">
      <section className="metric-grid"><MetricCard label="Income" value={formatCurrency(analytics.income)} tone="green" detail="Money in this month" /><MetricCard label="Expenses" value={formatCurrency(analytics.expenses)} tone="red" detail="Money out this month" /><MetricCard label="Net savings" value={formatCurrency(analytics.netSavings)} tone="blue" detail="Income minus expenses" /><MetricCard label="Budget used" value={`${Math.round(percentage)}%`} tone="purple" detail={totals.limit ? `${formatCurrency(totals.spent)} of ${formatCurrency(totals.limit)}` : 'No budgets set yet'} /></section>
      <section className="chart-grid">
        <article className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">Monthly pulse</span><h2>Income vs expenses</h2></div></div><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: 'This month', income: analytics.income, expenses: analytics.expenses }]}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${Number(value) / 1000}k`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="income" fill="#46a67c" radius={[6, 6, 0, 0]} /><Bar dataKey="expenses" fill="#ef6a62" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></article>
        <article className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">Where it goes</span><h2>Spending by category</h2></div></div>{analytics.categorySpending.length ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.categorySpending} dataKey="amount" nameKey="category" innerRadius={62} outerRadius={92} paddingAngle={3}>{analytics.categorySpending.map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer></div> : <StateMessage kind="empty">No expenses recorded for this month.</StateMessage>}</article>
      </section>
      <section className="panel budget-panel"><div className="panel-heading"><div><span className="eyebrow">Plan vs reality</span><h2>Budget utilization</h2></div></div>{budgets.length ? budgets.map((budget) => <div className="budget-row" key={budget.id}><div className="budget-label"><strong>{budget.category}</strong><span>{formatCurrency(budget.spent)} of {formatCurrency(budget.monthlyLimit)}</span></div><div className="progress-track"><div className={`progress-fill ${budget.usagePercentage > 100 ? 'over-budget' : ''}`} style={{ width: `${Math.min(budget.usagePercentage, 100)}%` }} /></div></div>) : <StateMessage kind="empty">No budgets set for this month yet.</StateMessage>}</section>
      <SpendingInsightPanel year={period.year} month={period.month} />
    </div>}
  </div>
}
