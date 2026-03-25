import type { Db, Collection, Filter } from 'mongodb'

interface MedicalTokenDoc {
  txid: string
  vout: number
  status: 'pending' | 'accessed' | 'receipt'
  eventType: 'upload' | 'accessed'
  protocolPrefix: string
  contentHash: string
  uhrpUrl: string
  senderKey: string
  recipientKey: string
  metadata: Record<string, unknown>
  keyID: string
  timestamp: number
  spendTxid: string | null
  accessedAt: number | null
  originalTxid: string | null
  createdAt: Date
  updatedAt: Date
}

interface LookupQuery {
  recipientKey?: string
  senderKey?: string
  identityKey?: string
  status?: string
  type?: 'audit' | 'inbox'
  contentHash?: string
}

interface LookupResult {
  type: 'output-list'
  outputs: Array<{
    txid: string
    outputIndex: number
    outputScript: string
    [key: string]: unknown
  }>
}

export class MedicalTokenLookupService {
  private collection: Collection<MedicalTokenDoc>

  constructor(db: Db) {
    this.collection = db.collection<MedicalTokenDoc>('medical_tokens')
  }

  async query(query: LookupQuery): Promise<LookupResult> {
    const filter: Filter<MedicalTokenDoc> = {}

    if (query.type === 'audit' && query.identityKey) {
      // Audit: all tokens where user is sender OR recipient
      filter.$or = [
        { senderKey: query.identityKey },
        { recipientKey: query.identityKey },
      ]
    } else if (query.recipientKey) {
      filter.recipientKey = query.recipientKey
      if (query.status) {
        filter.status = query.status as MedicalTokenDoc['status']
      }
    } else if (query.senderKey) {
      filter.senderKey = query.senderKey
    } else if (query.contentHash) {
      filter.contentHash = query.contentHash
    }

    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    return {
      type: 'output-list',
      outputs: docs.map((doc) => ({
        txid: doc.txid,
        outputIndex: doc.vout,
        outputScript: '', // Would contain the actual script hex
        status: doc.status,
        eventType: doc.eventType,
        contentHash: doc.contentHash,
        uhrpUrl: doc.uhrpUrl,
        senderKey: doc.senderKey,
        recipientKey: doc.recipientKey,
        metadata: doc.metadata,
        keyID: doc.keyID,
        timestamp: doc.timestamp,
        spendTxid: doc.spendTxid,
        accessedAt: doc.accessedAt,
      })),
    }
  }
}
