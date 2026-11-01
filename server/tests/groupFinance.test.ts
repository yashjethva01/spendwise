import { describe, expect, it } from 'vitest'

import {
  calculateExpenseShares,
  calculatePairwiseBalances,
  calculateGroupBalances,
  summarizeUserBalances,
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

  it('handles equal splits for two and four participants', () => {
    expect(calculateExpenseShares(101, 'equal', [
      { userId: 'alice' },
      { userId: 'bob' },
    ])).toEqual([
      { userId: 'alice', amountMinor: 51 },
      { userId: 'bob', amountMinor: 50 },
    ])
    expect(calculateExpenseShares(1001, 'equal', [
      { userId: 'alice' },
      { userId: 'bob' },
      { userId: 'cara' },
      { userId: 'dan' },
    ])).toEqual([
      { userId: 'alice', amountMinor: 251 },
      { userId: 'bob', amountMinor: 250 },
      { userId: 'cara', amountMinor: 250 },
      { userId: 'dan', amountMinor: 250 },
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
    expect(() => calculateExpenseShares(100, 'exact', [
      { userId: 'alice', value: -1 },
      { userId: 'bob', value: 101 },
    ])).toThrow('Exact shares must be non-negative')
    expect(() => calculateExpenseShares(100, 'percentage', [
      { userId: 'alice', value: 60 },
      { userId: 'bob', value: 30 },
    ])).toThrow('Percentages must add up to 100')
    expect(() => calculateExpenseShares(100, 'percentage', [
      { userId: 'alice', value: -1 },
      { userId: 'bob', value: 101 },
    ])).toThrow('Percentages must be non-negative')
  })

  it('excludes non-participants from shares and rounds percentages exactly', () => {
    expect(calculateExpenseShares(100, 'exact', [
      { userId: 'alice', value: 100 },
    ])).toEqual([{ userId: 'alice', amountMinor: 100 }])
    const shares = calculateExpenseShares(1001, 'percentage', [
      { userId: 'alice', value: 33.33 },
      { userId: 'bob', value: 33.33 },
      { userId: 'cara', value: 33.34 },
    ])
    expect(shares.reduce((sum, share) => sum + share.amountMinor, 0)).toBe(1001)
    expect(shares.map((share) => share.amountMinor)).toEqual([334, 334, 333])
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

  it('combines multiple expenses while crediting the payer only once', () => {
    const balances = calculateGroupBalances(
      ['alice', 'bob', 'cara'],
      [
        {
          payerId: 'alice',
          amountMinor: 900,
          shares: [
            { userId: 'alice', amountMinor: 300 },
            { userId: 'bob', amountMinor: 300 },
            { userId: 'cara', amountMinor: 300 },
          ],
        },
        {
          payerId: 'bob',
          amountMinor: 600,
          shares: [
            { userId: 'alice', amountMinor: 300 },
            { userId: 'bob', amountMinor: 300 },
          ],
        },
      ],
    )
    expect([...balances.entries()]).toEqual([
      ['alice', 300],
      ['bob', 0],
      ['cara', -300],
    ])
  })

  it('supports a payer who is not a participant', () => {
    const balances = calculateGroupBalances(
      ['alice', 'bob', 'cara'],
      [{
        payerId: 'alice',
        amountMinor: 1000,
        shares: [
          { userId: 'bob', amountMinor: 400 },
          { userId: 'cara', amountMinor: 600 },
        ],
      }],
    )
    expect([...balances.entries()]).toEqual([
      ['alice', 1000],
      ['bob', -400],
      ['cara', -600],
    ])
  })

  it('creates current-user pairwise balances and nets reciprocal debts', () => {
    const pairs = calculatePairwiseBalances(
      ['alice', 'bob', 'cara'],
      [
        {
          payerId: 'alice',
          amountMinor: 1000,
          shares: [{ userId: 'bob', amountMinor: 1000 }],
        },
        {
          payerId: 'bob',
          amountMinor: 400,
          shares: [{ userId: 'alice', amountMinor: 400 }],
        },
        {
          payerId: 'cara',
          amountMinor: 250,
          shares: [{ userId: 'bob', amountMinor: 250 }],
        },
      ],
      [{ payerId: 'bob', recipientId: 'alice', amountMinor: 100 }],
    )
    expect(pairs).toEqual([
      { fromUserId: 'bob', toUserId: 'alice', amountMinor: 500 },
      { fromUserId: 'bob', toUserId: 'cara', amountMinor: 250 },
    ])
    expect(summarizeUserBalances('alice', pairs)).toMatchObject({
      totalOwedMinor: 0,
      totalOwedToYouMinor: 500,
      netMinor: 500,
    })
  })

  it('does not create pairwise balances for settled expenses', () => {
    const pairs = calculatePairwiseBalances(
      ['alice', 'bob'],
      [{
        payerId: 'alice',
        amountMinor: 1000,
        shares: [{ userId: 'bob', amountMinor: 1000 }],
      }],
      [{ payerId: 'bob', recipientId: 'alice', amountMinor: 1000 }],
    )
    expect(pairs).toEqual([])
  })

  it('summarizes multiple counterparties and excludes zero balances', () => {
    const summary = summarizeUserBalances('alice', [
      { fromUserId: 'alice', toUserId: 'bob', amountMinor: 100 },
      { fromUserId: 'alice', toUserId: 'cara', amountMinor: 200 },
      { fromUserId: 'dan', toUserId: 'alice', amountMinor: 300 },
      { fromUserId: 'erin', toUserId: 'alice', amountMinor: 0 },
    ])
    expect(summary.owes).toHaveLength(2)
    expect(summary.owedToYou).toHaveLength(1)
    expect(summary.totalOwedMinor).toBe(300)
    expect(summary.totalOwedToYouMinor).toBe(300)
    expect(summary.netMinor).toBe(0)
  })
})
