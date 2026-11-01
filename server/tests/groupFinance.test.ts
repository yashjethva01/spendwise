import { describe, expect, it } from 'vitest'

import {
  calculateExpenseShares,
  calculateGroupBalances,
  suggestSettlements,
} from '../src/services/groupFinanceService.js'

describe('group finance calculations', () => {
  it('splits equal amounts deterministically in minor units', () => {
    expect(calculateExpenseShares(100, 'equal', [
      { userId: 'alice' },
      { userId: 'bob' },
      { userId: 'cara' },
    ])).toEqual([
      { userId: 'alice', amountMinor: 34 },
      { userId: 'bob', amountMinor: 33 },
      { userId: 'cara', amountMinor: 33 },
    ])
  })

  it('validates exact and percentage splits', () => {
    expect(calculateExpenseShares(1000, 'exact', [
      { userId: 'alice', value: 250 },
      { userId: 'bob', value: 750 },
    ])).toEqual([
      { userId: 'alice', amountMinor: 250 },
      { userId: 'bob', amountMinor: 750 },
    ])
    expect(calculateExpenseShares(999, 'percentage', [
      { userId: 'alice', value: 50 },
      { userId: 'bob', value: 50 },
    ])).toEqual([
      { userId: 'alice', amountMinor: 500 },
      { userId: 'bob', amountMinor: 499 },
    ])
    expect(() => calculateExpenseShares(100, 'exact', [
      { userId: 'alice', value: 40 },
      { userId: 'bob', value: 40 },
    ])).toThrow('Exact shares must add up')
  })

  it('calculates balances and simplifies multiple debts', () => {
    const balances = calculateGroupBalances(
      ['alice', 'bob', 'cara'],
      [{
        payerId: 'alice',
        amountMinor: 3000,
        shares: [
          { userId: 'alice', amountMinor: 1000 },
          { userId: 'bob', amountMinor: 1000 },
          { userId: 'cara', amountMinor: 1000 },
        ],
      }],
    )
    expect([...balances.entries()]).toEqual([
      ['alice', 2000],
      ['bob', -1000],
      ['cara', -1000],
    ])
    expect(suggestSettlements(balances)).toEqual([
      { payerId: 'bob', recipientId: 'alice', amountMinor: 1000 },
      { payerId: 'cara', recipientId: 'alice', amountMinor: 1000 },
    ])
  })

  it('applies settlements without changing total balance', () => {
    const balances = calculateGroupBalances(
      ['alice', 'bob'],
      [{
        payerId: 'alice',
        amountMinor: 1000,
        shares: [
          { userId: 'alice', amountMinor: 500 },
          { userId: 'bob', amountMinor: 500 },
        ],
      }],
      [{ payerId: 'bob', recipientId: 'alice', amountMinor: 500 }],
    )
    expect([...balances.values()]).toEqual([0, 0])
    expect([...balances.values()].reduce((sum, value) => sum + value, 0)).toBe(0)
  })
})
