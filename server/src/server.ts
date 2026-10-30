import { app } from './app.js'
import { connectToDatabase } from './config/database.js'
import { env } from './config/env.js'

async function startServer(): Promise<void> {
  await connectToDatabase(env.mongodbUri)

  app.listen(env.port, () => {
    console.log(`SpendWise server listening on http://localhost:${env.port}`)
  })
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error'
  console.error(`Server startup failed: ${message}`)
  process.exitCode = 1
})
