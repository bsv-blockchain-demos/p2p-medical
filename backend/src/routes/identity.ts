import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Db } from 'mongodb'

/** Ensure a value is a plain string — blocks NoSQL injection via objects/arrays */
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Escape special regex metacharacters so user input is matched literally */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

export function createIdentityRouter(db: Db) {
  const router = Router()
  router.use(limiter)
  const collection = db.collection('identities')

  // Register identity directly (fallback when overlay submit isn't available)
  router.post('/register', async (req, res) => {
    const identityKey = str(req.body.identityKey)
    const name = str(req.body.name)
    const role = str(req.body.role)
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
    const key = str(req.query.key)
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
    const identityKey = str(req.body.identityKey)
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
    const query = str(req.query.q)
    const role = str(req.query.role)

    if (!query || query.length < 2) {
      res.json([])
      return
    }

    try {
      const filter: Record<string, unknown> = {
        name: { $regex: escapeRegex(query), $options: 'i' },
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
