import type { Request, Response } from 'express'

import { createSettlement, listSettlements } from '../services/groupService.js'
import { settlementSchema } from '../validators/groupValidators.js'

export async function create(request: Request, response: Response): Promise<void> {
  response.status(201).json({ success: true, data: { settlement: await createSettlement(request.userId!, request.params.groupId as string, settlementSchema.parse(request.body)) } })
}
export async function list(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: { settlements: await listSettlements(request.userId!, request.params.groupId as string) } })
}
