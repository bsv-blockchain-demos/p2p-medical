import type { Db, Collection, Filter } from 'mongodb'

interface IdentityDoc {
  txid: string
  vout: number
  identityKey: string
  name: string
  role: 'patient' | 'doctor'
  registeredAt: number
  createdAt: Date
  updatedAt: Date
}

interface IdentityQuery {
  identityKey?: string
  name?: string
  role?: string
}

interface LookupResult {
  type: 'output-list'
  outputs: Array<{
    txid: string
    outputIndex: number
    identityKey: string
    name: string
    role: string
    registeredAt: number
  }>
}

export class IdentityLookupService {
  private collection: Collection<IdentityDoc>

  constructor(db: Db) {
    this.collection = db.collection<IdentityDoc>('identities')
  }

  async query(query: IdentityQuery): Promise<LookupResult> {
    const filter: Filter<IdentityDoc> = {}

    if (query.identityKey) {
      // Exact match — profile fetch
      filter.identityKey = query.identityKey
    } else if (query.name) {
      // Escape regex metacharacters to prevent injection / ReDoS
      const escaped = query.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.name = { $regex: escaped, $options: 'i' }
      if (query.role) {
        filter.role = query.role as IdentityDoc['role']
      }
    }

    const docs = await this.collection
      .find(filter)
      .sort({ name: 1 })
      .limit(25)
      .toArray()

    return {
      type: 'output-list',
      outputs: docs.map((doc) => ({
        txid: doc.txid,
        outputIndex: doc.vout,
        identityKey: doc.identityKey,
        name: doc.name,
        role: doc.role,
        registeredAt: doc.registeredAt,
      })),
    }
  }
}
