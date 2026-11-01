import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { createGroup, listGroups, listInvitations, respondToInvitation } from '../api/groupApi'
import { StateMessage } from '../components/StateMessage'
import { getApiErrorMessage } from '../utils/apiErrors'
import type { Group, GroupInvitation, GroupType } from '../types/groups'

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [invitations, setInvitations] = useState<GroupInvitation[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<GroupType>('friends')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invitationLoading, setInvitationLoading] = useState(true)
  const [invitationAction, setInvitationAction] = useState('')
  const [invitationMessage, setInvitationMessage] = useState('')
  const [search, setSearch] = useState('')

  async function loadGroups() {
    setLoading(true)
    setInvitationLoading(true)
    try {
      const [nextGroups, nextInvitations] = await Promise.all([listGroups(), listInvitations()])
      setGroups(nextGroups)
      setInvitations(nextInvitations)
      setError('')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load your groups.'))
    } finally {
      setLoading(false)
      setInvitationLoading(false)
    }
  }

  useEffect(() => { void loadGroups() }, [])

  const visibleGroups = groups.filter((group) => `${group.name} ${group.description ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  async function respond(invitation: GroupInvitation, status: 'accepted' | 'rejected') {
    setInvitationAction(invitation.id)
    setInvitationMessage('')
    setError('')
    try {
      await respondToInvitation(invitation.id, status)
      setInvitations((current) => current.filter((item) => item.id !== invitation.id))
      setInvitationMessage(status === 'accepted' ? `You joined ${invitation.groupName}.` : `Invitation to ${invitation.groupName} rejected.`)
      if (status === 'accepted') setGroups(await listGroups())
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'This invitation is no longer available.'))
    } finally {
      setInvitationAction('')
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      const group = await createGroup({ name: name.trim(), description: description.trim() || undefined, type })
      setGroups((current) => [group, ...current])
      setName(''); setDescription(''); setShowForm(false)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not create the group.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="content-page">
    <header className="page-header">
      <div><span className="eyebrow">Shared spending</span><h1>Group expenses</h1><p>Share expenses, track balances, and settle up with friends.</p></div>
      <button className="primary-button" type="button" onClick={() => setShowForm(true)}>Create group</button>
    </header>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    {invitationMessage && <div className="success-message">{invitationMessage}</div>}
    {invitations.length > 0 && <section className="panel invitations-panel">
      <div className="panel-heading"><div><span className="eyebrow">In-app notifications</span><h2>Pending invitations {invitations.length > 0 && <span className="count-badge">{invitations.length}</span>}</h2></div></div>
      {invitationLoading && <StateMessage kind="loading">Checking for invitations...</StateMessage>}
      {!invitationLoading && !invitations.length && <StateMessage kind="empty">No pending group invitations.</StateMessage>}
      {!invitationLoading && invitations.map((invitation) => <div className="invitation-row" key={invitation.id}><div><strong>{invitation.groupName}</strong><span>Invited by {invitation.inviterName} · {new Date(invitation.createdAt).toLocaleDateString()}</span></div><div className="invitation-actions"><button className="primary-button" type="button" disabled={invitationAction === invitation.id} onClick={() => void respond(invitation, 'accepted')}>{invitationAction === invitation.id ? 'Saving...' : 'Accept'}</button><button className="secondary-button" type="button" disabled={invitationAction === invitation.id} onClick={() => void respond(invitation, 'rejected')}>Reject</button></div></div>)}
    </section>}
    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false) }}><form className="modal-panel form-stack group-form" onSubmit={submit}>
      <div className="form-section-heading"><div><span className="eyebrow">New group</span><h2>Start sharing clearly</h2></div><button className="icon-button modal-close" type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Close create group form">×</button></div>
      <div className="field"><label htmlFor="group-name">Name</label><input id="group-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></div>
      <div className="field"><label htmlFor="group-description">Description <span>(optional)</span></label><input id="group-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></div>
      <div className="field"><label htmlFor="group-type">Type</label><select id="group-type" value={type} onChange={(event) => setType(event.target.value as GroupType)}><option value="friends">Friends</option><option value="trip">Trip</option><option value="home">Home</option><option value="couple">Couple</option><option value="other">Other</option></select></div>
      <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create group'}</button>
    </form></div>}
    {loading && <StateMessage kind="loading">Loading your groups...</StateMessage>}
    {!loading && !error && !groups.length && <StateMessage kind="empty">You have no groups yet. Create one to start sharing expenses.</StateMessage>}
    {!loading && groups.length > 0 && <div className="group-toolbar"><label htmlFor="group-search">Search groups</label><input id="group-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></div>}
    {!loading && !visibleGroups.length && groups.length > 0 && <StateMessage kind="empty">No groups match your search.</StateMessage>}
    {!loading && <section className="group-grid">{visibleGroups.map((group) => <Link className="panel group-card" to={`/groups/${group.id}`} key={group.id}><span className="eyebrow">{group.type}</span><h2>{group.name}</h2><p>{group.description || 'Shared expenses and balances'}</p><strong>{group.members.length} member{group.members.length === 1 ? '' : 's'}</strong></Link>)}</section>}
  </div>
}
