import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'

const PORT = process.env.PORT || 3003
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'message_box'

async function main() {
  const mongoClient = new MongoClient(MONGO_URL)
  await mongoClient.connect()
  const db = mongoClient.db(DB_NAME)
  const messages = db.collection('messages')

  await messages.createIndex({ recipient: 1, messageBox: 1, createdAt: -1 })
  await messages.createIndex({ recipient: 1, read: 1 })

  const app = express()
  app.use(cors())
  app.use(express.json())

  // Send a message to a recipient
  app.post('/sendMessage', async (req, res) => {
    try {
      const { recipient, messageBox, body } = req.body

      if (!recipient || !messageBox || !body) {
        res.status(400).json({ error: 'Missing required fields: recipient, messageBox, body' })
        return
      }

      const doc = {
        recipient,
        messageBox,
        body: typeof body === 'string' ? body : JSON.stringify(body),
        read: false,
        createdAt: new Date(),
      }

      await messages.insertOne(doc)
      res.json({ status: 'sent' })
    } catch (error) {
      console.error('Send error:', error)
      res.status(500).json({ error: 'Failed to send message' })
    }
  })

  // List messages for a recipient
  app.post('/listMessages', async (req, res) => {
    try {
      const { recipient, messageBox } = req.body

      if (!recipient) {
        res.status(400).json({ error: 'Missing recipient' })
        return
      }

      const filter: Record<string, unknown> = { recipient }
      if (messageBox) filter.messageBox = messageBox

      const docs = await messages
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()

      res.json(docs)
    } catch (error) {
      console.error('List error:', error)
      res.status(500).json({ error: 'Failed to list messages' })
    }
  })

  // Mark messages as read
  app.post('/acknowledgeMessage', async (req, res) => {
    try {
      const { messageIds } = req.body
      if (!messageIds?.length) {
        res.status(400).json({ error: 'Missing messageIds' })
        return
      }

      await messages.updateMany(
        { _id: { $in: messageIds } },
        { $set: { read: true } },
      )

      res.json({ status: 'acknowledged' })
    } catch (error) {
      console.error('Acknowledge error:', error)
      res.status(500).json({ error: 'Failed to acknowledge' })
    }
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'message-box' })
  })

  app.listen(PORT, () => {
    console.log(`Message Box Server running on port ${PORT}`)
  })
}

main().catch(console.error)
