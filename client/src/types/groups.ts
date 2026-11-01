export type GroupType = 'trip' | 'home' | 'couple' | 'friends' | 'other'
export type SplitMethod = 'equal' | 'exact' | 'percentage'

export interface GroupMember {
  userId: string
  name: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

export interface Group {
  id: string
  name: string
  description?: string
  type: GroupType
  ownerId: string
  members: GroupMember[]
  createdAt: string
  updatedAt: string
}

export interface GroupExpense {
  id: string
  groupId: string
  title: string
  amountMinor: number
  currency: 'INR'
  category: string
  date: string
  payerId: string
  payerName: string
  participantIds: string[]
  participantNames: string[]
  splitMethod: SplitMethod
  shares: Array<{ userId: string; name: string; amountMinor: number }>
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface GroupBalance {
  userId: string
  name: string
  amountMinor: number
}

export interface UserBalanceCounterparty {
  userId: string
  name: string
  amountMinor: number
}

export interface UserBalanceSummary {
  owes: UserBalanceCounterparty[]
  owedToYou: UserBalanceCounterparty[]
  totalOwedMinor: number
  totalOwedToYouMinor: number
  netMinor: number
}

export interface SuggestedSettlement {
  payerId: string
  payerName: string
  recipientId: string
  recipientName: string
  amountMinor: number
}

export interface GroupSettlement {
  id: string
  payerId: string
  payerName: string
  recipientId: string
  recipientName: string
  amountMinor: number
  status: 'completed'
  createdAt: string
}

export interface GroupInvitation {
  id: string
  groupId: string
  groupName: string
  inviterId: string
  inviterName: string
  inviterEmail?: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}
