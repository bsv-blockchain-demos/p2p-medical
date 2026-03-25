import type { Express } from 'express'
import type { Db } from 'mongodb'
import { MedicalTokenTopicManager } from './topic-manager.js'
import { MedicalTokenLookupService } from './lookup-service.js'

export async function setupOverlay(app: Express, db: Db) {
  const topicManager = new MedicalTokenTopicManager(db)
  const lookupService = new MedicalTokenLookupService(db)

  // SHIP transaction submission endpoint
  app.post('/submit', async (req, res) => {
    try {
      const { transaction, topics } = req.body

      if (!transaction || !topics) {
        res.status(400).json({ error: 'Missing transaction or topics' })
        return
      }

      // Process each topic
      for (const topic of topics) {
        if (topic === 'tm_medical_token') {
          await topicManager.processTransaction(transaction)
        }
      }

      res.json({ status: 'success' })
    } catch (error) {
      console.error('Submit error:', error)
      res.status(500).json({ error: 'Failed to process transaction' })
    }
  })

  // SLAP lookup query endpoint
  app.post('/lookup', async (req, res) => {
    try {
      const { service, query } = req.body

      if (service === 'ls_medical_token') {
        const result = await lookupService.query(query)
        res.json(result)
        return
      }

      res.status(404).json({ error: 'Unknown lookup service' })
    } catch (error) {
      console.error('Lookup error:', error)
      res.status(500).json({ error: 'Lookup failed' })
    }
  })

  console.log('Overlay engine initialized (tm_medical_token, ls_medical_token)')
}
