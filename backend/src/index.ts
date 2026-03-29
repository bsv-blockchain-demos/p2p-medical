import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { setupOverlay } from './overlay/index.js'
import { createIdentityRouter } from './routes/identity.js'
import { createTokenRouter } from './routes/tokens.js'

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
  // Audit events indexes
  const auditEventsCollection = db.collection('audit_events')
  await auditEventsCollection.createIndex({ senderKey: 1, createdAt: -1 })
  await auditEventsCollection.createIndex({ recipientKey: 1, createdAt: -1 })
  await auditEventsCollection.createIndex({ txid: 1 })
  await auditEventsCollection.createIndex({ uhrpUrl: 1 })
  // Identity indexes
  const identitiesCollection = db.collection('identities')
  await identitiesCollection.createIndex({ identityKey: 1 }, { unique: true })
  await identitiesCollection.createIndex({ name: 1 })
  await identitiesCollection.createIndex({ role: 1 })
  console.log('MongoDB indexes created')

  // Express app
  const app = express()
  app.use(cors())

  app.use(express.json({ limit: '50mb' }))

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // ARC broadcast proxy — frontend can't call ARC directly (CORS)
  app.post('/api/broadcast', async (req, res) => {
    try {
      const { rawTx } = req.body
      if (!rawTx) return res.status(400).json({ error: 'rawTx required' })
      const arcUrl = process.env.ARC_URL || 'https://api.taal.com/arc'
      const arcKey = process.env.ARC_API_KEY || ''

      const arcRes = await fetch(`${arcUrl}/v1/tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-MaxTimeout': '30',
          'X-WaitFor': 'RECEIVED',
          ...(arcKey ? { Authorization: `Bearer ${arcKey}` } : {}),
        },
        body: rawTx,
      })
      const data = await arcRes.json()
      res.status(arcRes.status).json(data)
    } catch (err) {
      console.error('ARC broadcast proxy error:', err)
      res.status(502).json({ error: 'Failed to reach ARC' })
    }
  })

  // Identity routes
  app.use('/api/identity', createIdentityRouter(db))

  // Token routes (direct API — primary data path)
  app.use('/api/tokens', createTokenRouter(db))

  // Setup overlay engine
  await setupOverlay(app, db)

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`)
  })
}

main().catch(console.error)
