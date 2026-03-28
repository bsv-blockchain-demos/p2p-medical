import { Router } from 'express'
import type { Db } from 'mongodb'

export function createTokenRouter(db: Db) {
  const router = Router()
  const collection = db.collection('medical_tokens')
  const auditEvents = db.collection('audit_events')

  // Direct token share — primary data path (bypasses PushDrop TX parsing)
  router.post('/share', async (req, res) => {
    const {
      txid,
      eventType,
      contentHash,
      uhrpUrl,
      senderKey,
      recipientKey,
      metadata,
      keyID,
    } = req.body

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
            metadata: metadata || {},
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
        metadata: metadata || {},
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
    const { txid, vout, accessedBy } = req.body

    if (!txid || !accessedBy) {
      res.status(400).json({ error: 'Missing required fields: txid, accessedBy' })
      return
    }

    try {
      const token = await collection.findOne({ txid, vout: vout ?? 0 })
      const result = await collection.updateOne(
        { txid, vout: vout ?? 0, status: 'encrypted' },
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
    const { txid, vout, accessedBy } = req.body

    if (!txid || !accessedBy) {
      res.status(400).json({ error: 'Missing required fields: txid, accessedBy' })
      return
    }

    try {
      const token = await collection.findOne({ txid, vout: vout ?? 0 })
      if (!token) {
        res.status(404).json({ error: 'Token not found' })
        return
      }

      // First-time view also flips status to decrypted
      if (token.status === 'encrypted') {
        await collection.updateOne(
          { txid, vout: vout ?? 0 },
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
