import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export type InvitationStatus = 'pending' | 'accepted' | 'rejected'

export interface GroupInvitation {
  groupId: Types.ObjectId
  inviterId: Types.ObjectId
  inviteeId: Types.ObjectId
  status: InvitationStatus
  createdAt: Date
  updatedAt: Date
}

export type GroupInvitationDocument = HydratedDocument<GroupInvitation>
export type GroupInvitationModel = Model<GroupInvitation>

const invitationSchema = new Schema<GroupInvitation>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      required: true,
      default: 'pending',
    },
  },
  { timestamps: true },
)

invitationSchema.index(
  { groupId: 1, inviteeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)
invitationSchema.index({ inviteeId: 1, status: 1 })

export const GroupInvitationModel = model<GroupInvitation, GroupInvitationModel>(
  'GroupInvitation',
  invitationSchema,
)
