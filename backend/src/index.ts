import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { setupOverlay } from './overlay/index.js'
import { identityRouter } from './routes/identity.js'

dotenv.config()

const PORT = process.env.PORT || 3001
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'p2p_medical'

async function main() {
  // Connect to MongoDB
  const mongoClient = new MongoClient(MONGO_URL)
  await mongoClient.connect()
  const db = mongoClient.db(DB_NAME)
  console.log(`Connected to MongoDB: ${DB_NAME}`)

  // Create indexes
  const tokensCollection = db.collection('medical_tokens')
  await tokensCollection.createIndex({ recipientKey: 1, status: 1 })
  await tokensCollection.createIndex({ senderKey: 1 })
  await tokensCollection.createIndex({ contentHash: 1 })
  await tokensCollection.createIndex({ txid: 1, vout: 1 }, { unique: true })
  await tokensCollection.createIndex({ status: 1, createdAt: -1 })
  console.log('MongoDB indexes created')

  // Express app
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '50mb' }))

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // Identity routes
  app.use('/api/identity', identityRouter)

  // Setup overlay engine
  await setupOverlay(app, db)

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`)
  })
}

main().catch(console.error)
