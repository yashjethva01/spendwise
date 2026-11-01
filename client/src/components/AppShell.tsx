import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function AppShell() {
  const { user, logout } = useAuth()
  return <div className="app-shell">
    <aside className="sidebar">
      <div><div className="sidebar-brand">SpendWise</div><p className="sidebar-caption">Your money, made clearer.</p></div>
      <nav className="main-nav" aria-label="Main navigation"><NavLink to="/" end>Overview</NavLink><NavLink to="/transactions">Transactions</NavLink><NavLink to="/budgets">Budgets</NavLink><NavLink to="/groups">Group Expenses</NavLink></nav>
      <div className="sidebar-user"><Link className="sidebar-profile-link" to="/profile"><div className="avatar">{user?.name.charAt(0).toUpperCase()}</div><div><strong>{user?.name}</strong><span>{user?.email}</span></div></Link><button type="button" className="icon-button" onClick={logout} aria-label="Sign out">↗</button></div>
    </aside>
    <main className="main-content"><Outlet /></main>
  </div>
}
