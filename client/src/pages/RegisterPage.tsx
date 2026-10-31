import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { useAuth } from '../features/auth/useAuth'
import { validateRegister, type FormErrors } from '../features/auth/authValidation'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateRegister(form)
    setErrors(validationErrors)
    setServerError('')
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (error) {
      setServerError(
        axios.isAxiosError(error)
          ? error.response?.data?.error?.message ?? 'Unable to create your account.'
          : 'Unable to create your account.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="form-heading">
        <span className="eyebrow">Start intentionally</span>
        <h2>Create your account</h2>
        <p>Build a simple, honest picture of where your money goes.</p>
      </div>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="server-error" role="alert">{serverError}</div>}
        <FormField
          id="name"
          label="Your name"
          value={form.name}
          placeholder="Yash Jethva"
          error={errors.name}
          onChange={(name) => setForm({ ...form, name })}
        />
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
          placeholder="At least 8 characters"
          error={errors.password}
          onChange={(password) => setForm({ ...form, password })}
        />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="form-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
