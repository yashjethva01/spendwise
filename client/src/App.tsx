import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { AppShell } from './components/AppShell'
import { AuthProvider } from './features/auth/AuthContext'
import { useAuth } from './features/auth/useAuth'
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const BudgetsPage = lazy(() => import('./pages/BudgetsPage').then((module) => ({ default: module.BudgetsPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })))
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((module) => ({ default: module.GroupsPage })))
const GroupDetailsPage = lazy(() => import('./pages/GroupDetailsPage').then((module) => ({ default: module.GroupDetailsPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const GroupMembersPage = lazy(() => import('./pages/GroupMembersPage').then((module) => ({ default: module.GroupMembersPage })))
const GroupSettleUpPage = lazy(() => import('./pages/GroupSettleUpPage').then((module) => ({ default: module.GroupSettleUpPage })))
const GroupExpensesPage = lazy(() => import('./pages/GroupExpensesPage').then((module) => ({ default: module.GroupExpensesPage })))

function RouteLoading() {
  return <div className="page-status">Loading page...</div>
}

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="page-status">Loading your workspace...</div>
  }

  return isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Suspense fallback={<RouteLoading />}><Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route path="/" element={<ProtectedRoute />}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="groups/:id" element={<GroupDetailsPage />} />
        <Route path="groups/:id/members" element={<GroupMembersPage />} />
        <Route path="groups/:id/settle-up" element={<GroupSettleUpPage />} />
        <Route path="groups/:id/expenses" element={<GroupExpensesPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
