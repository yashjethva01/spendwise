import type { Request, Response } from 'express'

import {
  createGroup,
  getGroup,
  inviteMember,
  leaveGroup,
  listGroups,
  listInvitations,
  respondToInvitation,
  updateGroup,
} from '../services/groupService.js'
import {
  createGroupSchema,
  invitationResponseSchema,
  inviteMemberSchema,
  updateGroupSchema,
} from '../validators/groupValidators.js'

export async function create(request: Request, response: Response): Promise<void> {
  response.status(201).json({ success: true, data: { group: await createGroup(request.userId!, createGroupSchema.parse(request.body)) } })
}
export async function list(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { groups: await listGroups(request.userId!) } })
}
export async function details(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { group: await getGroup(request.userId!, request.params.id as string) } })
}
export async function update(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { group: await updateGroup(request.userId!, request.params.id as string, updateGroupSchema.parse(request.body)) } })
}
export async function invite(request: Request, response: Response): Promise<void> {
  response.status(201).json({ success: true, data: { invitation: await inviteMember(request.userId!, request.params.id as string, inviteMemberSchema.parse(request.body).email) } })
}
export async function invitations(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { invitations: await listInvitations(request.userId!) } })
}
export async function respond(request: Request, response: Response): Promise<void> {
  const input = invitationResponseSchema.parse(request.body)
  response.json({ success: true, data: { invitation: await respondToInvitation(request.userId!, request.params.id as string, input.status) } })
}
export async function leave(request: Request, response: Response): Promise<void> {
  await leaveGroup(request.userId!, request.params.id as string)
  response.status(204).send()
}
