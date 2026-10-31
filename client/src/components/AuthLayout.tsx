import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <div className="brand-mark">SpendWise Pro</div>
        <div className="brand-copy">
          <span className="eyebrow">A clearer view of your money</span>
          <h1>Make every rupee count.</h1>
          <p>
            Organize spending, set intentional limits, and build better financial
            habits with one focused workspace.
          </p>
        </div>
        <div className="brand-footer">Private by design · Built for better decisions</div>
      </section>
      <section className="form-panel">{children}</section>
    </main>
  )
}
