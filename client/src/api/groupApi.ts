import apiClient from './client'
import type { Group, GroupBalance, GroupExpense, GroupInvitation, GroupType, SplitMethod, SuggestedSettlement } from '../types/groups'

export async function listInvitations() {
  const response = await apiClient.get<{ data: { invitations: GroupInvitation[] } }>('/groups/invitations')
  return response.data.data.invitations
}

export async function respondToInvitation(id: string, status: 'accepted' | 'rejected') {
  const response = await apiClient.post<{ data: { invitation: Pick<GroupInvitation, 'id' | 'status'> } }>(`/groups/invitations/${id}/respond`, { status })
  return response.data.data.invitation
}

export async function listGroups() {
  const response = await apiClient.get<{ data: { groups: Group[] } }>('/groups')
  return response.data.data.groups
}

export async function createGroup(input: { name: string; description?: string; type: GroupType }) {
  const response = await apiClient.post<{ data: { group: Group } }>('/groups', input)
  return response.data.data.group
}

export async function getGroup(id: string) {
  const response = await apiClient.get<{ data: { group: Group } }>(`/groups/${id}`)
  return response.data.data.group
}

export async function inviteGroupMember(groupId: string, email: string) {
  await apiClient.post(`/groups/${groupId}/invitations`, { email })
}

export async function listGroupExpenses(groupId: string) {
  const response = await apiClient.get<{ data: { items: GroupExpense[] } }>(`/groups/${groupId}/expenses`, { params: { page: 1, limit: 50 } })
  return response.data.data.items
}

export async function createGroupExpense(groupId: string, input: {
  title: string
  amountMinor: number
  currency: 'INR'
  category: string
  date: string
  payerId: string
  participants: Array<{ userId: string; value?: number }>
  splitMethod: SplitMethod
  notes?: string
}) {
  const response = await apiClient.post<{ data: { expense: GroupExpense } }>(`/groups/${groupId}/expenses`, input)
  return response.data.data.expense
}

export async function getGroupBalances(groupId: string) {
  const response = await apiClient.get<{ data: { balances: GroupBalance[] } }>(`/groups/${groupId}/expenses/balances`)
  return response.data.data.balances
}

export async function getSettlementSuggestions(groupId: string) {
  const response = await apiClient.get<{ data: { settlements: SuggestedSettlement[] } }>(`/groups/${groupId}/expenses/settlement-suggestions`)
  return response.data.data.settlements
}

export async function createGroupSettlement(groupId: string, input: SuggestedSettlement) {
  await apiClient.post(`/groups/${groupId}/expenses/settlements`, input)
}
