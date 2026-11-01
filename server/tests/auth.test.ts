import bcrypt from 'bcryptjs'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userStore = vi.hoisted(() => new Map<string, {
  _id: { toString: () => string }
  name: string
  email: string
  passwordHash: string
  comparePassword: (password: string) => Promise<boolean>
  save: () => Promise<void>
}>())

vi.mock('../src/models/User.js', () => ({
  UserModel: {
    findOne: (filter: { email: string }) => ({
      select: async () => [...userStore.values()].find((user) => user.email === filter.email) ?? null,
    }),
    findById: (id: string) => {
      const user = userStore.get(id) ?? null
      return {
        select: async () => user,
        then: (resolve: (value: typeof user) => unknown) => Promise.resolve(user).then(resolve),
      }
    },
    create: async (input: { name: string; email: string; passwordHash: string }) => {
      const user = {
        _id: { toString: () => input.email },
        id: input.email,
        ...input,
        comparePassword: (password: string) => bcrypt.compare(password, input.passwordHash),
        save: async () => {
          input.passwordHash = user.passwordHash
          userStore.set(input.email, user)
        },
      }
      userStore.set(input.email, user)
      return user
    },
  },
}))

const { app } = await import('../src/app.js')

describe('authentication API', () => {
  beforeEach(() => {
    userStore.clear()
  })

  it('registers a user and returns a token without a password', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Yash Jethva',
      email: 'YASH@example.com',
      password: 'secure-password',
    })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.token).toEqual(expect.any(String))
    expect(response.body.data.user).toEqual({
      id: 'yash@example.com',
      name: 'Yash Jethva',
      email: 'yash@example.com',
    })
    expect(response.body.data.user.password).toBeUndefined()
    expect(userStore.get('yash@example.com')?.passwordHash).not.toBe('secure-password')
  })

  it('logs in with valid credentials', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'secure-password',
    })

    const response = await request(app).post('/api/auth/login').send({
      email: 'TEST@example.com',
      password: 'secure-password',
    })

    expect(response.status).toBe(200)
    expect(response.body.data.token).toEqual(expect.any(String))

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.data.token}`)

    expect(meResponse.status).toBe(200)
    expect(meResponse.body.data.user.email).toBe('test@example.com')
  })

  it('rejects duplicate email', async () => {
    const input = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'secure-password',
    }

    await request(app).post('/api/auth/register').send(input)
    const response = await request(app).post('/api/auth/register').send(input)

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('An account with that email already exists.')
  })

  it('rejects malformed registration input', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.fields).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
    })
  })

  it('rejects invalid credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'missing@example.com',
      password: 'wrong-password',
    })

    expect(response.status).toBe(401)
    expect(response.body.error.message).toBe('Invalid email or password.')
  })

  it('rejects missing and invalid tokens on protected routes', async () => {
    const missingResponse = await request(app).get('/api/auth/me')
    const invalidResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')

    expect(missingResponse.status).toBe(401)
    expect(invalidResponse.status).toBe(401)
  })

  it('updates the authenticated user profile without exposing a password', async () => {
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'secure-password',
    })

    const response = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.token}`)
      .send({ name: 'Updated User', email: 'updated@example.com' })

    expect(response.status).toBe(200)
    expect(response.body.data.user).toEqual({
      id: 'test@example.com',
      name: 'Updated User',
      email: 'updated@example.com',
    })
    expect(response.body.data.user.passwordHash).toBeUndefined()
  })

  it('rejects changing the email to another account', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First User',
      email: 'first@example.com',
      password: 'secure-password',
    })
    const second = await request(app).post('/api/auth/register').send({
      name: 'Second User',
      email: 'second@example.com',
      password: 'secure-password',
    })

    const response = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${second.body.data.token}`)
      .send({ name: 'Second User', email: 'first@example.com' })

    expect(response.status).toBe(409)
  })

  it('rejects an incorrect current password and changes a valid password', async () => {
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'secure-password',
    })
    const token = registration.body.data.token

    const invalid = await request(app)
      .post('/api/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password', confirmPassword: 'new-password' })
    expect(invalid.status).toBe(401)

    const valid = await request(app)
      .post('/api/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'secure-password', newPassword: 'new-password', confirmPassword: 'new-password' })
    expect(valid.status).toBe(200)

    const login = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'new-password',
    })
    expect(login.status).toBe(200)
  })
})
