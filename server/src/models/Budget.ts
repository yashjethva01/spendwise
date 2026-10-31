import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface Budget {
  userId: Types.ObjectId
  category: string
  year: number
  month: number
  monthlyLimit: number
  createdAt: Date
  updatedAt: Date
}

export type BudgetDocument = HydratedDocument<Budget>
export type BudgetModel = Model<Budget>

const budgetSchema = new Schema<Budget>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    monthlyLimit: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { timestamps: true },
)

budgetSchema.index(
  { userId: 1, year: 1, month: 1, category: 1 },
  { unique: true },
)
budgetSchema.index({ userId: 1, year: 1, month: 1 })

export const BudgetModel = model<Budget, BudgetModel>('Budget', budgetSchema)
