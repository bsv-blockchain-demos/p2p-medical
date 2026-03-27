import { Router } from 'express'
import type { Db } from 'mongodb'

export function createIdentityRouter(db: Db) {
  const router = Router()
  const collection = db.collection('identities')

  // Register identity directly (fallback when overlay submit isn't available)
  router.post('/register', async (req, res) => {
    const { identityKey, name, role } = req.body
    if (!identityKey || !name || !role) {
      res.status(400).json({ error: 'Missing identityKey, name, or role' })
      return
    }
    if (role !== 'patient' && role !== 'doctor') {
      res.status(400).json({ error: 'Role must be patient or doctor' })
      return
    }
    try {
      const existing = await collection.findOne({ identityKey })

      if (existing && existing.role !== role) {
        res.status(409).json({ error: `Identity already registered as ${existing.role}` })
        return
      }

      if (existing) {
        await collection.updateOne(
          { identityKey },
          { $set: { name, updatedAt: new Date() } },
        )
      } else {
        await collection.insertOne({
          identityKey,
          name,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      res.json({ status: 'ok', identityKey, name, role })
    } catch (err) {
      console.error('Register error:', err)
      res.status(500).json({ error: 'Registration failed' })
    }
  })

  // Fetch single profile by identity key
  router.get('/profile', async (req, res) => {
    const key = req.query.key as string
    if (!key) {
      res.json(null)
      return
    }

    try {
      const doc = await collection.findOne({ identityKey: key })
      if (!doc) {
        res.json(null)
        return
      }
      res.json({ name: doc.name, role: doc.role, identityKey: doc.identityKey })
    } catch {
      res.status(500).json({ error: 'Failed to fetch profile' })
    }
  })

  // Delete profile (allows re-registration with a different role)
  router.delete('/profile', async (req, res) => {
    const { identityKey } = req.body
    if (!identityKey) {
      res.status(400).json({ error: 'Missing identityKey' })
      return
    }
    try {
      const result = await collection.deleteOne({ identityKey })
      if (result.deletedCount === 0) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      res.json({ status: 'ok' })
    } catch (err) {
      console.error('Delete profile error:', err)
      res.status(500).json({ error: 'Failed to delete profile' })
    }
  })

  // Search identities by name, optional role filter
  router.get('/search', async (req, res) => {
    const query = req.query.q as string
    const role = req.query.role as string | undefined

    if (!query || query.length < 2) {
      res.json([])
      return
    }

    try {
      const filter: Record<string, unknown> = {
        name: { $regex: query, $options: 'i' },
      }
      if (role) {
        filter.role = role
      }

      const docs = await collection
        .find(filter)
        .sort({ name: 1 })
        .limit(25)
        .toArray()

      const results = docs.map((doc) => ({
        name: doc.name,
        publicKey: doc.identityKey,
        role: doc.role,
      }))

      res.json(results)
    } catch {
      res.status(500).json({ error: 'Search failed' })
    }
  })

  return router
}
