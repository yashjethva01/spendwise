import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export type GroupType = 'trip' | 'home' | 'couple' | 'friends' | 'other'
export type GroupRole = 'owner' | 'admin' | 'member'

export interface GroupMember {
  userId: Types.ObjectId
  role: GroupRole
  joinedAt: Date
}

export interface Group {
  name: string
  description?: string
  type: GroupType
  ownerId: Types.ObjectId
  members: GroupMember[]
  createdAt: Date
  updatedAt: Date
}

export type GroupDocument = HydratedDocument<Group>
export type GroupModel = Model<Group>

const memberSchema = new Schema<GroupMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], required: true },
    joinedAt: { type: Date, required: true },
  },
  { _id: false },
)

const groupSchema = new Schema<Group>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['trip', 'home', 'couple', 'friends', 'other'],
      required: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [memberSchema], required: true },
  },
  { timestamps: true },
)

groupSchema.index({ 'members.userId': 1 })

export const GroupModel = model<Group, GroupModel>('Group', groupSchema)
