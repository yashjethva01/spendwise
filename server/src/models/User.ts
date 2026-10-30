import bcrypt from 'bcryptjs'
import { model, Schema, type HydratedDocument, type Model } from 'mongoose'

export interface User {
  name: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export interface UserMethods {
  comparePassword(password: string): Promise<boolean>
}

export type UserDocument = HydratedDocument<User, UserMethods>
export type UserModel = Model<User, object, UserMethods>

const userSchema = new Schema<User, UserModel, UserMethods>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
)

userSchema.methods.comparePassword = function comparePassword(password: string) {
  return bcrypt.compare(password, this.passwordHash)
}

export const UserModel = model<User, UserModel>('User', userSchema)
