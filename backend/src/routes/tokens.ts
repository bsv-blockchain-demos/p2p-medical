import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Db } from 'mongodb'

/** Ensure a value is a plain string — blocks NoSQL injection via objects/arrays */
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Ensure a value is a non-negative integer */
function safeVout(v: unknown): number {
  const n = typeof v === 'number' ? v : 0
  return Number.isInteger(n) && n >= 0 ? n : 0
}

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

export function createTokenRouter(db: Db) {
  const router = Router()
  router.use(limiter)
  const collection = db.collection('medical_tokens')
  const auditEvents = db.collection('audit_events')

  // Direct token share — primary data path (bypasses PushDrop TX parsing)
  router.post('/share', async (req, res) => {
    const txid = str(req.body.txid)
    const eventType = str(req.body.eventType)
    const contentHash = str(req.body.contentHash)
    const uhrpUrl = str(req.body.uhrpUrl)
    const senderKey = str(req.body.senderKey)
    const recipientKey = str(req.body.recipientKey)
    const metadata = req.body.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
      ? req.body.metadata as Record<string, unknown>
      : {}
    const keyID = str(req.body.keyID)

    if (!txid || !contentHash || !senderKey || !recipientKey) {
      res.status(400).json({ error: 'Missing required fields: txid, contentHash, senderKey, recipientKey' })
      return
    }

    try {
      await collection.updateOne(
        { txid, vout: 0 },
        {
          $set: {
            txid,
            vout: 0,
            status: 'encrypted',
            eventType: eventType || 'upload',
            protocolPrefix: 'p2p medical',
            contentHash,
            uhrpUrl: uhrpUrl || '',
            senderKey,
            recipientKey,
            metadata,
            keyID: keyID || '',
            timestamp: Date.now(),
            spendTxid: null,
            accessedAt: null,
            originalTxid: null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      )

      await auditEvents.insertOne({
        event: 'upload',
        txid,
        senderKey,
        recipientKey,
        uhrpUrl: uhrpUrl || '',
        contentHash,
        keyID: keyID || '',
        metadata,
        createdAt: new Date(),
      })

      res.json({ status: 'ok', txid })
    } catch (err) {
      console.error('Token share error:', err)
      res.status(500).json({ error: 'Failed to share token' })
    }
  })

  // Mark token as accessed (POC: replaces on-chain spend)
  router.post('/access', async (req, res) => {
    const txid = str(req.body.txid)
    const vout = safeVout(req.body.vout)
    const accessedBy = str(req.body.accessedBy)

    if (!txid || !accessedBy) {
      res.status(400).json({ error: 'Missing required fields: txid, accessedBy' })
      return
    }

    try {
      const token = await collection.findOne({ txid, vout })
      const result = await collection.updateOne(
        { txid, vout, status: 'encrypted' },
        {
          $set: {
            status: 'decrypted',
            accessedAt: Date.now(),
            updatedAt: new Date(),
          },
        },
      )

      if (result.matchedCount === 0) {
        res.status(404).json({ error: 'Token not found or already accessed' })
        return
      }

      await auditEvents.insertOne({
        event: 'access',
        txid,
        accessedBy,
        senderKey: token?.senderKey || '',
        recipientKey: token?.recipientKey || '',
        uhrpUrl: token?.uhrpUrl || '',
        contentHash: token?.contentHash || '',
        keyID: token?.keyID || '',
        metadata: token?.metadata || {},
        createdAt: new Date(),
      })

      res.json({ status: 'ok', txid })
    } catch (err) {
      console.error('Token access error:', err)
      res.status(500).json({ error: 'Failed to confirm access' })
    }
  })

  // Record a file view (always succeeds, always creates audit event)
  router.post('/view', async (req, res) => {
    const txid = str(req.body.txid)
    const vout = safeVout(req.body.vout)
    const accessedBy = str(req.body.accessedBy)

    if (!txid || !accessedBy) {
      res.status(400).json({ error: 'Missing required fields: txid, accessedBy' })
      return
    }

    try {
      const token = await collection.findOne({ txid, vout })
      if (!token) {
        res.status(404).json({ error: 'Token not found' })
        return
      }

      // First-time view also flips status to decrypted
      if (token.status === 'encrypted') {
        await collection.updateOne(
          { txid, vout },
          {
            $set: {
              status: 'decrypted',
              accessedAt: Date.now(),
              updatedAt: new Date(),
            },
          },
        )
      }

      await auditEvents.insertOne({
        event: 'view',
        txid,
        accessedBy,
        senderKey: token.senderKey || '',
        recipientKey: token.recipientKey || '',
        uhrpUrl: token.uhrpUrl || '',
        contentHash: token.contentHash || '',
        keyID: token.keyID || '',
        metadata: token.metadata || {},
        createdAt: new Date(),
      })

      res.json({ status: 'ok', txid })
    } catch (err) {
      console.error('Token view error:', err)
      res.status(500).json({ error: 'Failed to record view' })
    }
  })

  return router
}
