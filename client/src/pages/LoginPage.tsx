import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { useAuth } from '../features/auth/useAuth'
import { validateLogin, type FormErrors } from '../features/auth/authValidation'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateLogin(form)
    setErrors(validationErrors)
    setServerError('')
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      await login(form)
      navigate('/', { replace: true })
    } catch (error) {
      setServerError(
        axios.isAxiosError(error)
          ? error.response?.data?.error?.message ?? 'Unable to sign in right now.'
          : 'Unable to sign in right now.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="form-heading">
        <span className="eyebrow">Welcome back</span>
        <h2>Sign in to your workspace</h2>
        <p>Pick up where you left off and keep your spending on track.</p>
      </div>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="server-error" role="alert">{serverError}</div>}
        <FormField
          id="email"
          label="Email address"
          type="email"
          value={form.email}
          placeholder="you@example.com"
          error={errors.email}
          onChange={(email) => setForm({ ...form, email })}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={form.password}
          placeholder="Enter your password"
          error={errors.password}
          onChange={(password) => setForm({ ...form, password })}
        />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="form-switch">
        New to SpendWise? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  )
}
