export function MetricCard({ label, value, tone, detail }: { label: string; value: string; tone: string; detail?: string }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>
}
