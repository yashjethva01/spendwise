import { useAuth } from '../features/auth/useAuth'

export function WelcomePage() {
  const { user, logout } = useAuth()

  return (
    <main className="welcome-page">
      <section className="welcome-card">
        <span className="eyebrow">Your workspace</span>
        <h1>Welcome, {user?.name}.</h1>
        <p>
          Your secure foundation is ready. Transactions, budgets, and financial
          insights will appear here in the next stages.
        </p>
        <button className="secondary-button" type="button" onClick={logout}>
          Sign out
        </button>
      </section>
    </main>
  )
}
