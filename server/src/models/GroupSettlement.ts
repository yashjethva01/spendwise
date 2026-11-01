import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export type SettlementStatus = 'completed'

export interface GroupSettlement {
  groupId: Types.ObjectId
  payerId: Types.ObjectId
  recipientId: Types.ObjectId
  amountMinor: number
  currency: 'INR'
  status: SettlementStatus
  idempotencyKey?: string
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export type GroupSettlementDocument = HydratedDocument<GroupSettlement>
export type GroupSettlementModel = Model<GroupSettlement>

const settlementSchema = new Schema<GroupSettlement>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['INR'], required: true, default: 'INR' },
    status: { type: String, enum: ['completed'], required: true, default: 'completed' },
    idempotencyKey: { type: String, trim: true, sparse: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

settlementSchema.index({ groupId: 1, createdAt: -1 })

export const GroupSettlementModel = model<GroupSettlement, GroupSettlementModel>(
  'GroupSettlement',
  settlementSchema,
)
