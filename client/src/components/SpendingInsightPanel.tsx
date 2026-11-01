import { useState } from 'react'

import { getSpendingInsight } from '../api/financeApi'
import { StateMessage } from './StateMessage'
import { getApiErrorMessage } from '../utils/apiErrors'
import type { SpendingInsight } from '../types/finance'

interface SpendingInsightPanelProps {
  year: number
  month: number
}

export function SpendingInsightPanel({ year, month }: SpendingInsightPanelProps) {
  const [insight, setInsight] = useState<SpendingInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      setInsight(await getSpendingInsight(year, month))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Spending insights are currently unavailable.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel insight-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Spending assistant</span>
          <h2>Make sense of this month</h2>
        </div>
        <button className="secondary-button" type="button" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Reviewing...' : insight ? 'Refresh summary' : 'Get summary'}
        </button>
      </div>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      {!error && !insight && !loading && <p className="insight-placeholder">Ask for a short explanation of your category patterns and budget usage.</p>}
      {loading && <StateMessage kind="loading">Reviewing your aggregated figures...</StateMessage>}
      {insight && !loading && <div className="insight-result"><p>{insight.summary}</p><small>{insight.disclaimer}</small></div>}
    </section>
  )
}
