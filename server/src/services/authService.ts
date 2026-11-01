import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'
import { UserModel, type UserDocument } from '../models/User.js'
import type { LoginInput, PasswordChangeInput, ProfileUpdateInput, RegisterInput } from '../validators/authValidators.js'
import { AppError } from '../middleware/errorHandler.js'

const SALT_ROUNDS = 12

export interface PublicUser {
  id: string
  name: string
  email: string
}

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  }
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.toLowerCase()
  const existingUser = await UserModel.findOne({ email }).select('+passwordHash')

  if (existingUser) {
    throw new AppError(409, 'An account with that email already exists.')
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)
  const user = await UserModel.create({
    name: input.name,
    email,
    passwordHash,
  })

  return { user: toPublicUser(user), token: signToken(user.id) }
}

export async function loginUser(input: LoginInput) {
  const email = input.email.toLowerCase()
  const user = await UserModel.findOne({ email }).select('+passwordHash')
  const validPassword = user ? await user.comparePassword(input.password) : false

  if (!user || !validPassword) {
    throw new AppError(401, 'Invalid email or password.')
  }

  return { user: toPublicUser(user), token: signToken(user.id) }
}

export async function getUserById(userId: string) {
  const user = await UserModel.findById(userId)

  if (!user) {
    throw new AppError(401, 'Authenticated user was not found.')
  }

  return toPublicUser(user)
}

export async function updateUserProfile(userId: string, input: ProfileUpdateInput) {
  const email = input.email.toLowerCase()
  const existingUser = await UserModel.findOne({ email }).select('+passwordHash')

  if (existingUser && existingUser.id !== userId) {
    throw new AppError(409, 'An account with that email already exists.')
  }

  const user = await UserModel.findById(userId)
  if (!user) throw new AppError(401, 'Authenticated user was not found.')

  user.name = input.name
  user.email = email
  await user.save()
  return toPublicUser(user)
}

export async function changeUserPassword(userId: string, input: PasswordChangeInput) {
  const user = await UserModel.findById(userId).select('+passwordHash')
  if (!user) throw new AppError(401, 'Authenticated user was not found.')

  if (!(await user.comparePassword(input.currentPassword))) {
    throw new AppError(401, 'Current password is incorrect.')
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS)
  await user.save()
}
