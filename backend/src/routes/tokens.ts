import { Router } from 'express'
import type { Db } from 'mongodb'

export function createTokenRouter(db: Db) {
  const router = Router()
  const collection = db.collection('medical_tokens')

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
            status: 'pending',
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
      const result = await collection.updateOne(
        { txid, vout: vout ?? 0, status: 'pending' },
        {
          $set: {
            status: 'accessed',
            accessedAt: Date.now(),
            updatedAt: new Date(),
          },
        },
      )

      if (result.matchedCount === 0) {
        res.status(404).json({ error: 'Token not found or already accessed' })
        return
      }

      res.json({ status: 'ok', txid })
    } catch (err) {
      console.error('Token access error:', err)
      res.status(500).json({ error: 'Failed to confirm access' })
    }
  })

  return router
}
