import 'dotenv/config'

const port = Number(process.env.PORT ?? 5000)
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
const mongodbUri = process.env.MONGODB_URI?.trim()

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

if (!mongodbUri || mongodbUri === 'your_mongodb_connection_string') {
  throw new Error(
    'MONGODB_URI is required. Add your MongoDB connection string to server/.env.',
  )
}

export const env = {
  port,
  clientUrl,
  mongodbUri,
} as const
