import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ownerId = '507f1f77bcf86cd799439011'
const inviteeId = '507f1f77bcf86cd799439012'
const otherId = '507f1f77bcf86cd799439013'
const groupId = '507f1f77bcf86cd799439021'
const invitationId = '507f1f77bcf86cd799439031'

type Invitation = {
  _id: { toString: () => string }
  groupId: { toString: () => string }
  inviterId: { toString: () => string }
  inviteeId: { toString: () => string }
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}

const stores = vi.hoisted(() => ({
  invitations: [] as Invitation[],
  groups: [] as Array<{
    _id: { toString: () => string }
    name: string
    ownerId: { toString: () => string }
    members: Array<{ userId: { toString: () => string }; role: string; joinedAt: Date }>
    save: () => Promise<void>
  }>,
  users: new Map<string, { _id: { toString: () => string }; name: string; email: string }>(),
}))

function query<T>(value: T) {
  return {
    select: async () => value,
    then: (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve),
  }
}

vi.mock('../src/models/User.js', () => ({
  UserModel: {
    findOne: (filter: { email: string }) => query(
      [...stores.users.values()].find((user) => user.email === filter.email) ?? null,
    ),
    findById: (id: { toString: () => string }) => query(stores.users.get(id.toString()) ?? null),
  },
}))

vi.mock('../src/models/Group.js', () => ({
  GroupModel: {
    findOne: async (filter: Record<string, unknown>) => {
      const id = (filter._id as { toString: () => string })?.toString()
      const memberId = (filter['members.userId'] as { toString: () => string })?.toString()
      return stores.groups.find((group) =>
        group._id.toString() === id &&
        (!memberId || group.members.some((member) => member.userId.toString() === memberId)),
      ) ?? null
    },
    findById: (id: { toString: () => string }) => query(
      stores.groups.find((group) => group._id.toString() === id.toString()) ?? null,
    ),
  },
}))

vi.mock('../src/models/GroupInvitation.js', () => ({
  GroupInvitationModel: {
    create: async (input: Omit<Invitation, '_id' | 'createdAt'>) => {
      const invitation = {
        ...input,
        _id: { toString: () => invitationId },
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      }
      stores.invitations.push(invitation)
      return invitation
    },
    find: (filter: Record<string, unknown>) => ({
      sort: async () => stores.invitations.filter((invitation) =>
        invitation.inviteeId.toString() === (filter.inviteeId as { toString: () => string }).toString() &&
        invitation.status === filter.status,
      ),
    }),
    findOne: async (filter: Record<string, unknown>) => stores.invitations.find((invitation) =>
      (!filter._id || invitation._id.toString() === (filter._id as { toString: () => string }).toString()) &&
      (!filter.groupId || invitation.groupId.toString() === (filter.groupId as { toString: () => string }).toString()) &&
      (!filter.inviteeId || invitation.inviteeId.toString() === (filter.inviteeId as { toString: () => string }).toString()) &&
      invitation.status === filter.status,
    ) ?? null,
    findOneAndUpdate: async (filter: Record<string, unknown>, update: { status: Invitation['status'] }) => {
      const invitation = stores.invitations.find((item) =>
        item._id.toString() === (filter._id as { toString: () => string }).toString() &&
        item.inviteeId.toString() === (filter.inviteeId as { toString: () => string }).toString() &&
        item.status === filter.status,
      )
      if (!invitation) return null
      invitation.status = update.status
      return invitation
    },
  },
}))

const { app } = await import('../src/app.js')

function authHeader(userId: string) {
  return `Bearer ${jwt.sign({ sub: userId }, 'test-only-secret-that-is-at-least-32-characters')}`
}

describe('group invitations API', () => {
  beforeEach(() => {
    stores.invitations.length = 0
    stores.groups.length = 0
    stores.users.clear()
    stores.users.set(ownerId, { _id: { toString: () => ownerId }, name: 'Owner', email: 'owner@example.com' })
    stores.users.set(inviteeId, { _id: { toString: () => inviteeId }, name: 'Invitee', email: 'invitee@example.com' })
    stores.groups.push({
      _id: { toString: () => groupId },
      name: 'Weekend trip',
      ownerId: { toString: () => ownerId },
      members: [{ userId: { toString: () => ownerId }, role: 'owner', joinedAt: new Date() }],
      save: async () => undefined,
    })
  })

  it('persists an invitation and exposes it only to the intended user', async () => {
    const createResponse = await request(app)
      .post(`/api/groups/${groupId}/invitations`)
      .set('Authorization', authHeader(ownerId))
      .send({ email: 'invitee@example.com' })

    expect(createResponse.status).toBe(201)

    const inviteeResponse = await request(app)
      .get('/api/groups/invitations')
      .set('Authorization', authHeader(inviteeId))
    const otherResponse = await request(app)
      .get('/api/groups/invitations')
      .set('Authorization', authHeader(otherId))

    expect(inviteeResponse.body.data.invitations[0]).toMatchObject({
      groupName: 'Weekend trip',
      inviterName: 'Owner',
      status: 'pending',
    })
    expect(otherResponse.body.data.invitations).toEqual([])
  })

  it('rejects unregistered users and duplicate pending invitations', async () => {
    const missingUser = await request(app)
      .post(`/api/groups/${groupId}/invitations`)
      .set('Authorization', authHeader(ownerId))
      .send({ email: 'missing@example.com' })
    expect(missingUser.status).toBe(404)

    const first = await request(app)
      .post(`/api/groups/${groupId}/invitations`)
      .set('Authorization', authHeader(ownerId))
      .send({ email: 'invitee@example.com' })
    const duplicate = await request(app)
      .post(`/api/groups/${groupId}/invitations`)
      .set('Authorization', authHeader(ownerId))
      .send({ email: 'invitee@example.com' })

    expect(first.status).toBe(201)
    expect(duplicate.status).toBe(409)
  })

  it('accepts once and adds the recipient to the group', async () => {
    stores.invitations.push({
      _id: { toString: () => invitationId },
      groupId: { toString: () => groupId },
      inviterId: { toString: () => ownerId },
      inviteeId: { toString: () => inviteeId },
      status: 'pending',
      createdAt: new Date(),
    })

    const response = await request(app)
      .post(`/api/groups/invitations/${invitationId}/respond`)
      .set('Authorization', authHeader(inviteeId))
      .send({ status: 'accepted' })

    expect(response.status).toBe(200)
    expect(stores.invitations[0].status).toBe('accepted')
    expect(stores.groups[0].members.some((member) => member.userId.toString() === inviteeId)).toBe(true)

    const repeated = await request(app)
      .post(`/api/groups/invitations/${invitationId}/respond`)
      .set('Authorization', authHeader(inviteeId))
      .send({ status: 'accepted' })
    expect(repeated.status).toBe(404)
  })

  it('rejects without adding the recipient and blocks unauthorized responses', async () => {
    stores.invitations.push({
      _id: { toString: () => invitationId },
      groupId: { toString: () => groupId },
      inviterId: { toString: () => ownerId },
      inviteeId: { toString: () => inviteeId },
      status: 'pending',
      createdAt: new Date(),
    })

    const unauthorized = await request(app)
      .post(`/api/groups/invitations/${invitationId}/respond`)
      .set('Authorization', authHeader(ownerId))
      .send({ status: 'rejected' })
    expect(unauthorized.status).toBe(404)

    const rejected = await request(app)
      .post(`/api/groups/invitations/${invitationId}/respond`)
      .set('Authorization', authHeader(inviteeId))
      .send({ status: 'rejected' })
    expect(rejected.status).toBe(200)
    expect(stores.invitations[0].status).toBe('rejected')
    expect(stores.groups[0].members).toHaveLength(1)
  })
})
