import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export type GroupExpenseSplitMethod = 'equal' | 'exact' | 'percentage'

export interface ExpenseShare {
  userId: Types.ObjectId
  amountMinor: number
}

export interface GroupExpense {
  groupId: Types.ObjectId
  title: string
  amountMinor: number
  currency: 'INR'
  category: string
  date: Date
  payerId: Types.ObjectId
  participantIds: Types.ObjectId[]
  splitMethod?: GroupExpenseSplitMethod
  shares: ExpenseShare[]
  notes?: string
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export type GroupExpenseDocument = HydratedDocument<GroupExpense>
export type GroupExpenseModel = Model<GroupExpense>

const shareSchema = new Schema<ExpenseShare>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const expenseSchema = new Schema<GroupExpense>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['INR'], required: true, default: 'INR' },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    date: { type: Date, required: true },
    payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    splitMethod: {
      type: String,
      enum: ['equal', 'exact', 'percentage'],
      required: false,
    },
    shares: { type: [shareSchema], required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

expenseSchema.index({ groupId: 1, date: -1 })

export const GroupExpenseModel = model<GroupExpense, GroupExpenseModel>(
  'GroupExpense',
  expenseSchema,
)
