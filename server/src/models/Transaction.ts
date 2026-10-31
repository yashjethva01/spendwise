import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  userId: Types.ObjectId
  type: TransactionType
  amount: number
  category: string
  description?: string
  date: Date
  createdAt: Date
  updatedAt: Date
}

export type TransactionDocument = HydratedDocument<Transaction>
export type TransactionModel = Model<Transaction>

const transactionSchema = new Schema<Transaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
)

transactionSchema.index({ userId: 1, date: -1 })

export const TransactionModel = model<Transaction, TransactionModel>(
  'Transaction',
  transactionSchema,
)
