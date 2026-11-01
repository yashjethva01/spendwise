import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getGroup, inviteGroupMember } from '../api/groupApi'
import { StateMessage } from '../components/StateMessage'
import { useAuth } from '../features/auth/useAuth'
import type { Group } from '../types/groups'
import { getApiErrorMessage } from '../utils/apiErrors'

export function GroupMembersPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    try { setGroup(await getGroup(id)) } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not load members.')) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  async function invite(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try { await inviteGroupMember(id, email); setEmail(''); setMessage('Invitation sent.') } catch (requestError) { setError(getApiErrorMessage(requestError, 'Could not send the invitation.')) } finally { setSaving(false) }
  }
  if (loading) return <div className="content-page"><StateMessage kind="loading">Loading members...</StateMessage></div>
  if (!group) return <div className="content-page"><StateMessage kind="error">{error || 'Group not found.'}</StateMessage></div>
  const currentMember = group.members.find((member) => member.userId === user?.id)
  const canInvite = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  return <div className="content-page">
    <header className="page-header"><div><Link to={`/groups/${id}`} className="back-link">← {group.name}</Link><span className="eyebrow">Group members</span><h1>Members · {group.members.length}</h1><p>People sharing expenses in this group.</p></div></header>
    {error && <StateMessage kind="error">{error}</StateMessage>}{message && <div className="success-message">{message}</div>}
    <section className="panel member-list-panel">{group.members.map((member) => <div className="member-row" key={member.userId}><div className="member-identity"><div className="avatar">{(member.userId === user?.id ? 'You' : member.name).charAt(0).toUpperCase()}</div><span>{member.userId === user?.id ? `You · ${member.name}` : member.name}</span></div><small>{member.role}</small></div>)}</section>
    {canInvite && <section className="panel group-section"><div className="panel-heading"><div><span className="eyebrow">Member management</span><h2>Invite someone</h2></div></div><form className="inline-form" onSubmit={invite}><label className="sr-only" htmlFor="member-email">Registered user email</label><input id="member-email" type="email" placeholder="registered-user@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="secondary-button" type="submit" disabled={saving}>{saving ? 'Sending...' : 'Send invite'}</button></form></section>}
  </div>
}
