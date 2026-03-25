import { Router } from 'express'
import { LookupResolver } from '@bsv/sdk'

export const identityRouter = Router()

identityRouter.get('/search', async (req, res) => {
  const query = req.query.q as string
  if (!query || query.length < 2) {
    res.json([])
    return
  }

  try {
    // Query identity overlay for matching names/keys
    const resolver = new LookupResolver()
    const result = await resolver.query({
      service: 'ls_identity',
      query: { name: query },
    })

    if (result.type !== 'output-list' || !result.outputs) {
      res.json([])
      return
    }

    // Parse identity results
    const identities = result.outputs.map((output) => ({
      name: query, // Placeholder — real identity overlay returns structured data
      publicKey: `${output.outputIndex}`, // Placeholder — would decode from BEEF
    }))

    res.json(identities)
  } catch {
    // Identity overlay may not be available — return empty
    res.json([])
  }
})
