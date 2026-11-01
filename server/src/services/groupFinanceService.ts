import { AppError } from '../middleware/errorHandler.js'

export type SplitMethod = 'equal' | 'exact' | 'percentage'

export interface SplitParticipant {
  userId: string
  value?: number
}

export interface SplitShare {
  userId: string
  amountMinor: number
}

export interface GroupExpenseForBalance {
  payerId: string
  amountMinor: number
  shares: SplitShare[]
}

export interface SettlementForBalance {
  payerId: string
  recipientId: string
  amountMinor: number
}

export interface SuggestedSettlement {
  payerId: string
  recipientId: string
  amountMinor: number
}

export interface PairwiseBalance {
  fromUserId: string
  toUserId: string
  amountMinor: number
}

const PERCENTAGE_TOLERANCE = 0.000001

function assertPositiveMinorAmount(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new AppError(400, 'Amount must be a positive whole number of minor units.')
  }
}

function assertUniqueParticipants(participants: SplitParticipant[]): void {
  const ids = new Set(participants.map(({ userId }) => userId))
  if (ids.size !== participants.length) {
    throw new AppError(400, 'Participants must be unique.')
  }
}

function allocateRemainder(
  amountMinor: number,
  allocations: Array<{ userId: string; amountMinor: number; remainder: number }>,
): SplitShare[] {
  const allocated = allocations.reduce((sum, item) => sum + item.amountMinor, 0)
  let remainder = amountMinor - allocated

  allocations
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((allocation) => {
      if (remainder > 0) {
        allocation.amountMinor += 1
        remainder -= 1
      }
    })

  if (remainder !== 0) {
    throw new AppError(400, 'The split could not be allocated safely.')
  }

  return allocations.map(({ userId, amountMinor: share }) => ({
    userId,
    amountMinor: share,
  }))
}

export function calculateExpenseShares(
  amountMinor: number,
  method: SplitMethod,
  participants: SplitParticipant[],
): SplitShare[] {
  assertPositiveMinorAmount(amountMinor)
  if (participants.length === 0) {
    throw new AppError(400, 'At least one participant is required.')
  }
  assertUniqueParticipants(participants)

  if (method === 'exact') {
    const shares = participants.map(({ userId, value }) => {
      if (!Number.isSafeInteger(value) || value === undefined || value < 0) {
        throw new AppError(400, 'Exact shares must be non-negative whole minor units.')
      }
      return { userId, amountMinor: value }
    })
    if (shares.reduce((sum, share) => sum + share.amountMinor, 0) !== amountMinor) {
      throw new AppError(400, 'Exact shares must add up to the expense amount.')
    }
    return shares
  }

  if (method === 'percentage') {
    const percentages = participants.map(({ userId, value }) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new AppError(400, 'Percentages must be non-negative numbers.')
      }
      return { userId, percentage: value }
    })
    const total = percentages.reduce((sum, share) => sum + share.percentage, 0)
    if (Math.abs(total - 100) > PERCENTAGE_TOLERANCE) {
      throw new AppError(400, 'Percentages must add up to 100.')
    }
    return allocateRemainder(
      amountMinor,
      percentages.map(({ userId, percentage }) => {
        const exact = (amountMinor * percentage) / 100
        const floor = Math.floor(exact)
        return { userId, amountMinor: floor, remainder: exact - floor }
      }),
    )
  }

  const base = Math.floor(amountMinor / participants.length)
  const remainder = amountMinor % participants.length
  return participants.map(({ userId }, index) => ({
    userId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }))
}

export function calculateGroupBalances(
  memberIds: string[],
  expenses: GroupExpenseForBalance[],
  settlements: SettlementForBalance[] = [],
): Map<string, number> {
  const balances = new Map(memberIds.map((memberId) => [memberId, 0]))

  for (const expense of expenses) {
    assertPositiveMinorAmount(expense.amountMinor)
    if (!balances.has(expense.payerId)) {
      throw new AppError(400, 'Expense payer must be a group member.')
    }
    const shareTotal = expense.shares.reduce((sum, share) => sum + share.amountMinor, 0)
    if (shareTotal !== expense.amountMinor) {
      throw new AppError(400, 'Expense shares must equal the expense amount.')
    }
    balances.set(expense.payerId, balances.get(expense.payerId)! + expense.amountMinor)
    for (const share of expense.shares) {
      if (!balances.has(share.userId)) {
        throw new AppError(400, 'Expense participant must be a group member.')
      }
      balances.set(share.userId, balances.get(share.userId)! - share.amountMinor)
    }
  }

  for (const settlement of settlements) {
    assertPositiveMinorAmount(settlement.amountMinor)
    if (
      settlement.payerId === settlement.recipientId ||
      !balances.has(settlement.payerId) ||
      !balances.has(settlement.recipientId)
    ) {
      throw new AppError(400, 'Settlement participants must be different group members.')
    }
    balances.set(
      settlement.payerId,
      balances.get(settlement.payerId)! + settlement.amountMinor,
    )
    balances.set(
      settlement.recipientId,
      balances.get(settlement.recipientId)! - settlement.amountMinor,
    )
  }

  return balances
}

export function suggestSettlements(
  balances: Map<string, number>,
): SuggestedSettlement[] {
  const creditors = [...balances.entries()]
    .filter(([, amountMinor]) => amountMinor > 0)
    .map(([userId, amountMinor]) => ({ userId, amountMinor }))
  const debtors = [...balances.entries()]
    .filter(([, amountMinor]) => amountMinor < 0)
    .map(([userId, amountMinor]) => ({ userId, amountMinor: -amountMinor }))

  const suggestions: SuggestedSettlement[] = []
  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]
    const debtor = debtors[debtorIndex]
    const amountMinor = Math.min(creditor.amountMinor, debtor.amountMinor)
    if (amountMinor > 0 && creditor.userId !== debtor.userId) {
      suggestions.push({
        payerId: debtor.userId,
        recipientId: creditor.userId,
        amountMinor,
      })
    }
    creditor.amountMinor -= amountMinor
    debtor.amountMinor -= amountMinor
    if (creditor.amountMinor === 0) creditorIndex += 1
    if (debtor.amountMinor === 0) debtorIndex += 1
  }

  return suggestions
}

function pairKey(fromUserId: string, toUserId: string): string {
  return `${fromUserId}->${toUserId}`
}

export function calculatePairwiseBalances(
  memberIds: string[],
  expenses: GroupExpenseForBalance[],
  settlements: SettlementForBalance[] = [],
): PairwiseBalance[] {
  const members = new Set(memberIds)
  const raw = new Map<string, number>()

  const add = (fromUserId: string, toUserId: string, amountMinor: number) => {
    if (!members.has(fromUserId) || !members.has(toUserId) || fromUserId === toUserId) {
      throw new AppError(400, 'Pairwise participants must be different group members.')
    }
    raw.set(pairKey(fromUserId, toUserId), (raw.get(pairKey(fromUserId, toUserId)) ?? 0) + amountMinor)
  }

  for (const expense of expenses) {
    assertPositiveMinorAmount(expense.amountMinor)
    if (!members.has(expense.payerId)) throw new AppError(400, 'Expense payer must be a group member.')
    const shareTotal = expense.shares.reduce((sum, share) => sum + share.amountMinor, 0)
    if (shareTotal !== expense.amountMinor) throw new AppError(400, 'Expense shares must equal the expense amount.')
    for (const share of expense.shares) {
      if (!members.has(share.userId)) throw new AppError(400, 'Expense participant must be a group member.')
      if (!Number.isSafeInteger(share.amountMinor) || share.amountMinor < 0) {
        throw new AppError(400, 'Expense shares must be non-negative whole minor units.')
      }
      if (share.userId !== expense.payerId && share.amountMinor > 0) {
        add(share.userId, expense.payerId, share.amountMinor)
      }
    }
  }

  for (const settlement of settlements) {
    assertPositiveMinorAmount(settlement.amountMinor)
    add(settlement.payerId, settlement.recipientId, -settlement.amountMinor)
  }

  const pairs: PairwiseBalance[] = []
  const processed = new Set<string>()
  for (const [key, amount] of raw) {
    const [fromUserId, toUserId] = key.split('->')
    const reverseKey = pairKey(toUserId, fromUserId)
    if (processed.has(key) || processed.has(reverseKey)) continue
    const net = amount - (raw.get(reverseKey) ?? 0)
    if (net > 0) pairs.push({ fromUserId, toUserId, amountMinor: net })
    if (net < 0) pairs.push({ fromUserId: toUserId, toUserId: fromUserId, amountMinor: -net })
    processed.add(key)
    processed.add(reverseKey)
  }
  return pairs.filter((pair) => pair.amountMinor > 0)
}

export function summarizeUserBalances(
  userId: string,
  pairs: PairwiseBalance[],
): { owes: PairwiseBalance[]; owedToYou: PairwiseBalance[]; totalOwedMinor: number; totalOwedToYouMinor: number; netMinor: number } {
  const owes = pairs.filter((pair) => pair.fromUserId === userId && pair.amountMinor > 0)
  const owedToYou = pairs.filter((pair) => pair.toUserId === userId && pair.amountMinor > 0)
  const totalOwedMinor = owes.reduce((sum, pair) => sum + pair.amountMinor, 0)
  const totalOwedToYouMinor = owedToYou.reduce((sum, pair) => sum + pair.amountMinor, 0)
  return {
    owes,
    owedToYou,
    totalOwedMinor,
    totalOwedToYouMinor,
    netMinor: totalOwedToYouMinor - totalOwedMinor,
  }
}
