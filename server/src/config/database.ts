
import mongoose from 'mongoose'

export async function connectToDatabase(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    })
    console.log('Connected to MongoDB.')
  } catch (error) {
    console.error('Full MongoDB connection error:')
    console.dir(error, { depth: 5 })
    throw error
  }
}

export function getDatabaseStatus(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
}
