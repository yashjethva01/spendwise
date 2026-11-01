import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { changePassword, updateProfile } from '../api/authApi'
import { StateMessage } from '../components/StateMessage'
import { useAuth } from '../features/auth/useAuth'
import { getApiErrorMessage } from '../utils/apiErrors'

export function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSavingProfile(true); setError(''); setMessage('')
    try { updateUser(await updateProfile({ name, email })); setMessage('Profile updated successfully.') }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not update your profile.')) }
    finally { setSavingProfile(false) }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault(); setSavingPassword(true); setError(''); setMessage('')
    try { await changePassword({ currentPassword, newPassword, confirmPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Password updated successfully.') }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not update your password.')) }
    finally { setSavingPassword(false) }
  }

  return <div className="content-page">
    <header className="page-header"><div><Link to="/" className="back-link">← Overview</Link><span className="eyebrow">Account</span><h1>Your profile</h1><p>Review the account currently signed in to SpendWise.</p></div></header>
    {error && <StateMessage kind="error">{error}</StateMessage>}{message && <div className="success-message">{message}</div>}
    <section className="panel profile-card"><div className="profile-avatar">{user?.name.charAt(0).toUpperCase()}</div><div><span className="eyebrow">Signed in as</span><h2>{user?.name || 'Unknown user'}</h2><p>{user?.email}</p></div><button className="secondary-button" type="button" onClick={logout}>Sign out</button></section>
    <section className="profile-form-grid">
      <form className="panel form-stack" onSubmit={saveProfile}><div><span className="eyebrow">Personal information</span><h2>Edit profile</h2></div><div className="field"><label htmlFor="profile-name">Full name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></div><div className="field"><label htmlFor="profile-email">Email address</label><input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><button className="primary-button" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save profile'}</button></form>
      <form className="panel form-stack" onSubmit={savePassword}><div><span className="eyebrow">Password and security</span><h2>Change password</h2></div><div className="field"><label htmlFor="current-password">Current password</label><input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" /></div><div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={72} required autoComplete="new-password" /></div><div className="field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={72} required autoComplete="new-password" /></div><button className="primary-button" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Update password'}</button></form>
    </section>
  </div>
}
