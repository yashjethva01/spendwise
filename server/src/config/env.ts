import 'dotenv/config'

const port = Number(process.env.PORT ?? 5000)
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
const mongodbUri = process.env.MONGODB_URI?.trim()
const jwtSecret = process.env.JWT_SECRET?.trim()
const groqApiKey = process.env.GROQ_API_KEY?.trim()
const groqModel = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b'

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

if (!mongodbUri || mongodbUri === 'your_mongodb_connection_string') {
  throw new Error(
    'MONGODB_URI is required. Add your MongoDB connection string to server/.env.',
  )
}

if (!jwtSecret || jwtSecret === 'your_long_random_secret' || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET is required and must be at least 32 characters long.',
  )
}

export const env = {
  port,
  clientUrl,
  mongodbUri,
  jwtSecret,
  jwtExpiresIn: '1h' as const,
  groqApiKey,
  groqModel,
} as const
