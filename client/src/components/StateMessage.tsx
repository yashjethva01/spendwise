import type { ReactNode } from 'react'

export function StateMessage({ kind, children }: { kind: 'loading' | 'empty' | 'error'; children: ReactNode }) {
  return <div className={`state-message state-${kind}`} role={kind === 'error' ? 'alert' : undefined}>{children}</div>
}
