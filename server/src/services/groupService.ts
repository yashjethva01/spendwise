import { Types } from 'mongoose'

import { GroupModel, type GroupDocument, type GroupMember } from '../models/Group.js'
import { GroupInvitationModel } from '../models/GroupInvitation.js'
import { GroupExpenseModel } from '../models/GroupExpense.js'
import { GroupSettlementModel } from '../models/GroupSettlement.js'
import { UserModel } from '../models/User.js'
import { AppError } from '../middleware/errorHandler.js'
import {
  calculateExpenseShares,
  calculateGroupBalances,
  suggestSettlements,
} from './groupFinanceService.js'
import type {
  CreateGroupExpenseInput,
  CreateGroupInput,
  GroupExpenseQuery,
  SettlementInput,
  UpdateGroupExpenseInput,
  UpdateGroupInput,
} from '../validators/groupValidators.js'

function parseId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new AppError(400, `${label} must be valid.`)
  return new Types.ObjectId(value)
}

function member(group: GroupDocument, userId: string): GroupMember {
  const found = group.members.find((item) => item.userId.toString() === userId)
  if (!found) throw new AppError(403, 'You must be a group member to perform this action.')
  return found
}

function canManage(group: GroupDocument, userId: string): boolean {
  const role = member(group, userId).role
  return role === 'owner' || role === 'admin'
}

function groupResponse(group: GroupDocument) {
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
    type: group.type,
    ownerId: group.ownerId.toString(),
    members: group.members.map((item) => ({
      userId: item.userId.toString(),
      role: item.role,
      joinedAt: item.joinedAt,
    })),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

function expenseResponse(expense: { _id: Types.ObjectId; groupId: Types.ObjectId; title: string; amountMinor: number; currency: string; category: string; date: Date; payerId: Types.ObjectId; participantIds: Types.ObjectId[]; splitMethod: string; shares: Array<{ userId: Types.ObjectId; amountMinor: number }>; notes?: string; createdBy: Types.ObjectId; createdAt: Date; updatedAt: Date }) {
  return {
    id: expense._id.toString(),
    groupId: expense.groupId.toString(),
    title: expense.title,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    payerId: expense.payerId.toString(),
    participantIds: expense.participantIds.map((id) => id.toString()),
    splitMethod: expense.splitMethod,
    shares: expense.shares.map((share) => ({
      userId: share.userId.toString(),
      amountMinor: share.amountMinor,
    })),
    notes: expense.notes,
    createdBy: expense.createdBy.toString(),
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  }
}

async function getGroupForMember(groupId: string, userId: string) {
  const group = await GroupModel.findOne({
    _id: parseId(groupId, 'Group ID'),
    'members.userId': parseId(userId, 'User ID'),
  })
  if (!group) throw new AppError(404, 'Group not found.')
  return group
}

export async function createGroup(userId: string, input: CreateGroupInput) {
  const ownerId = parseId(userId, 'User ID')
  const now = new Date()
  const group = await GroupModel.create({
    ...input,
    ownerId,
    members: [{ userId: ownerId, role: 'owner', joinedAt: now }],
  })
  return groupResponse(group)
}

export async function listGroups(userId: string) {
  const groups = await GroupModel.find({
    'members.userId': parseId(userId, 'User ID'),
  }).sort({ updatedAt: -1 })
  return groups.map(groupResponse)
}

export async function getGroup(userId: string, groupId: string) {
  return groupResponse(await getGroupForMember(groupId, userId))
}

export async function updateGroup(userId: string, groupId: string, input: UpdateGroupInput) {
  const group = await getGroupForMember(groupId, userId)
  if (!canManage(group, userId)) throw new AppError(403, 'Only group admins can update this group.')
  Object.assign(group, input)
  await group.save()
  return groupResponse(group)
}

export async function inviteMember(userId: string, groupId: string, email: string) {
  const group = await getGroupForMember(groupId, userId)
  if (!canManage(group, userId)) throw new AppError(403, 'Only group admins can invite members.')
  const invitee = await UserModel.findOne({ email }).select('_id')
  if (!invitee) throw new AppError(404, 'No registered user exists with that email.')
  if (group.members.some((item) => item.userId.toString() === invitee._id.toString())) {
    throw new AppError(409, 'That user is already a group member.')
  }
  const existingInvitation = await GroupInvitationModel.findOne({
    groupId: group._id,
    inviteeId: invitee._id,
    status: 'pending',
  })
  if (existingInvitation) throw new AppError(409, 'That user already has a pending invitation.')
  const invitation = await GroupInvitationModel.create({
    groupId: group._id,
    inviterId: parseId(userId, 'User ID'),
    inviteeId: invitee._id,
    status: 'pending',
  })
  return {
    id: invitation._id.toString(),
    groupId: invitation.groupId.toString(),
    inviteeId: invitation.inviteeId.toString(),
    status: invitation.status,
    createdAt: invitation.createdAt,
  }
}

export async function listInvitations(userId: string) {
  const invitations = await GroupInvitationModel.find({
    inviteeId: parseId(userId, 'User ID'),
    status: 'pending',
  }).sort({ createdAt: -1 })
  return Promise.all(invitations.map(async (invitation) => {
    const [group, inviter] = await Promise.all([
      GroupModel.findById(invitation.groupId).select('name'),
      UserModel.findById(invitation.inviterId).select('name email'),
    ])
    return {
      id: invitation._id.toString(),
      groupId: invitation.groupId.toString(),
      groupName: group?.name ?? 'Unavailable group',
      inviterId: invitation.inviterId.toString(),
      inviterName: inviter?.name ?? 'Unknown user',
      inviterEmail: inviter?.email,
      status: invitation.status,
      createdAt: invitation.createdAt,
    }
  }))
}

export async function respondToInvitation(userId: string, invitationId: string, status: 'accepted' | 'rejected') {
  const invitation = await GroupInvitationModel.findOneAndUpdate(
    {
    _id: parseId(invitationId, 'Invitation ID'),
    inviteeId: parseId(userId, 'User ID'),
    status: 'pending',
    },
    { status },
    { new: true },
  )
  if (!invitation) throw new AppError(404, 'Invitation not found.')
  if (status === 'accepted') {
    const group = await GroupModel.findOne({ _id: invitation.groupId })
    if (!group) {
      await GroupInvitationModel.findOneAndUpdate(
        { _id: invitation._id, status: 'accepted' },
        { status: 'pending' },
      )
      throw new AppError(404, 'Group is no longer available.')
    }
    if (!group.members.some((item) => item.userId.toString() === userId)) {
      group.members.push({ userId: parseId(userId, 'User ID'), role: 'member', joinedAt: new Date() })
      await group.save()
    }
  }
  return { id: invitation._id.toString(), status: invitation.status }
}

export async function leaveGroup(userId: string, groupId: string) {
  const group = await getGroupForMember(groupId, userId)
  const currentBalances = await getGroupBalances(userId, groupId)
  if (group.ownerId.toString() === userId) {
    throw new AppError(400, 'The group owner cannot leave the group.')
  }
  if (currentBalances.find((item) => item.userId === userId)?.amountMinor !== 0) {
    throw new AppError(409, 'Settle your outstanding group balance before leaving.')
  }
  group.members = group.members.filter((item) => item.userId.toString() !== userId)
  await group.save()
}

function groupMemberIds(group: GroupDocument): string[] {
  return group.members.map((item) => item.userId.toString())
}

function validateExpenseMembers(group: GroupDocument, input: { payerId: string; participants: Array<{ userId: string }> }) {
  const ids = new Set(groupMemberIds(group))
  if (!ids.has(input.payerId) || input.participants.some(({ userId }) => !ids.has(userId))) {
    throw new AppError(400, 'Payer and participants must be group members.')
  }
}

export async function createExpense(userId: string, groupId: string, input: CreateGroupExpenseInput) {
  const group = await getGroupForMember(groupId, userId)
  validateExpenseMembers(group, input)
  const shares = calculateExpenseShares(input.amountMinor, input.splitMethod, input.participants)
  const expense = await GroupExpenseModel.create({
    groupId: group._id,
    title: input.title,
    amountMinor: input.amountMinor,
    currency: input.currency,
    category: input.category,
    date: input.date,
    payerId: parseId(input.payerId, 'Payer ID'),
    participantIds: input.participants.map(({ userId: participantId }) => parseId(participantId, 'Participant ID')),
    splitMethod: input.splitMethod,
    shares: shares.map((share) => ({ userId: parseId(share.userId, 'Participant ID'), amountMinor: share.amountMinor })),
    notes: input.notes,
    createdBy: parseId(userId, 'User ID'),
  })
  return expenseResponse(expense)
}

function expenseFilter(groupId: string, query: GroupExpenseQuery) {
  return {
    groupId: parseId(groupId, 'Group ID'),
    ...(query.category ? { category: query.category } : {}),
    ...(query.payerId ? { payerId: parseId(query.payerId, 'Payer ID') } : {}),
    ...(query.memberId ? { participantIds: parseId(query.memberId, 'Member ID') } : {}),
    ...(query.from || query.to ? { date: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) } } : {}),
  }
}

export async function listExpenses(userId: string, groupId: string, query: GroupExpenseQuery) {
  await getGroupForMember(groupId, userId)
  const filter = expenseFilter(groupId, query)
  const [items, total] = await Promise.all([
    GroupExpenseModel.find(filter).sort({ date: -1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    GroupExpenseModel.countDocuments(filter),
  ])
  return {
    items: items.map(expenseResponse),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  }
}

async function getExpenseForMember(userId: string, groupId: string, expenseId: string) {
  await getGroupForMember(groupId, userId)
  const expense = await GroupExpenseModel.findOne({
    _id: parseId(expenseId, 'Expense ID'),
    groupId: parseId(groupId, 'Group ID'),
  })
  if (!expense) throw new AppError(404, 'Expense not found.')
  return expense
}

export async function updateExpense(userId: string, groupId: string, expenseId: string, input: UpdateGroupExpenseInput) {
  const group = await getGroupForMember(groupId, userId)
  const existing = await getExpenseForMember(userId, groupId, expenseId)
  if (existing.createdBy.toString() !== userId && !canManage(group, userId)) {
    throw new AppError(403, 'Only the expense creator or a group admin can update this expense.')
  }
  const merged = {
    title: input.title ?? existing.title,
    amountMinor: input.amountMinor ?? existing.amountMinor,
    currency: input.currency ?? existing.currency,
    category: input.category ?? existing.category,
    date: input.date ?? existing.date,
    payerId: input.payerId ?? existing.payerId.toString(),
    participants: input.participants ?? existing.participantIds.map((id, index) => ({ userId: id.toString(), value: existing.shares[index]?.amountMinor })),
    splitMethod: input.splitMethod ?? existing.splitMethod,
    notes: input.notes ?? existing.notes,
  }
  validateExpenseMembers(group, merged)
  const shares = calculateExpenseShares(merged.amountMinor, merged.splitMethod, merged.participants)
  Object.assign(existing, {
    ...merged,
    payerId: parseId(merged.payerId, 'Payer ID'),
    participantIds: merged.participants.map(({ userId: participantId }) => parseId(participantId, 'Participant ID')),
    shares: shares.map((share) => ({ userId: parseId(share.userId, 'Participant ID'), amountMinor: share.amountMinor })),
  })
  await existing.save()
  return expenseResponse(existing)
}

export async function deleteExpense(userId: string, groupId: string, expenseId: string) {
  const group = await getGroupForMember(groupId, userId)
  const expense = await getExpenseForMember(userId, groupId, expenseId)
  if (expense.createdBy.toString() !== userId && !canManage(group, userId)) {
    throw new AppError(403, 'Only the expense creator or a group admin can delete this expense.')
  }
  await expense.deleteOne()
}

export async function getGroupBalances(userId: string, groupId: string) {
  const group = await getGroupForMember(groupId, userId)
  const [expenses, settlements] = await Promise.all([
    GroupExpenseModel.find({ groupId: group._id }),
    GroupSettlementModel.find({ groupId: group._id, status: 'completed' }),
  ])
  const balances = calculateGroupBalances(
    groupMemberIds(group),
    expenses.map((expense) => ({
      payerId: expense.payerId.toString(),
      amountMinor: expense.amountMinor,
      shares: expense.shares.map((share) => ({ userId: share.userId.toString(), amountMinor: share.amountMinor })),
    })),
    settlements.map((settlement) => ({
      payerId: settlement.payerId.toString(),
      recipientId: settlement.recipientId.toString(),
      amountMinor: settlement.amountMinor,
    })),
  )
  return [...balances.entries()].map(([memberId, amountMinor]) => ({ userId: memberId, amountMinor }))
}

export async function getSettlementSuggestions(userId: string, groupId: string) {
  const balances = await getGroupBalances(userId, groupId)
  return suggestSettlements(new Map(balances.map((item) => [item.userId, item.amountMinor])))
}

export async function createSettlement(userId: string, groupId: string, input: SettlementInput) {
  const group = await getGroupForMember(groupId, userId)
  const balances = new Map((await getGroupBalances(userId, groupId)).map((item) => [item.userId, item.amountMinor]))
  if (input.payerId !== userId && !canManage(group, userId)) {
    throw new AppError(403, 'Only the debtor or a group admin can record this settlement.')
  }
  if (input.payerId === input.recipientId) throw new AppError(400, 'A settlement cannot be made to yourself.')
  if ((balances.get(input.payerId) ?? 0) >= 0 || (balances.get(input.recipientId) ?? 0) <= 0) {
    throw new AppError(400, 'Settlement participants do not have a payable balance.')
  }
  if (input.amountMinor > Math.min(-(balances.get(input.payerId) ?? 0), balances.get(input.recipientId) ?? 0)) {
    throw new AppError(400, 'Settlement exceeds the current outstanding balance.')
  }
  const settlement = await GroupSettlementModel.create({
    groupId: group._id,
    payerId: parseId(input.payerId, 'Payer ID'),
    recipientId: parseId(input.recipientId, 'Recipient ID'),
    amountMinor: input.amountMinor,
    currency: 'INR',
    status: 'completed',
    createdBy: parseId(userId, 'User ID'),
  })
  return {
    id: settlement._id.toString(),
    payerId: settlement.payerId.toString(),
    recipientId: settlement.recipientId.toString(),
    amountMinor: settlement.amountMinor,
    status: settlement.status,
    createdAt: settlement.createdAt,
  }
}

export async function listSettlements(userId: string, groupId: string) {
  await getGroupForMember(groupId, userId)
  const settlements = await GroupSettlementModel.find({ groupId: parseId(groupId, 'Group ID') }).sort({ createdAt: -1 })
  return settlements.map((settlement) => ({
    id: settlement._id.toString(),
    payerId: settlement.payerId.toString(),
    recipientId: settlement.recipientId.toString(),
    amountMinor: settlement.amountMinor,
    status: settlement.status,
    createdAt: settlement.createdAt,
  }))
}
