import type { Db, Collection, Filter } from 'mongodb'

interface MedicalTokenDoc {
  txid: string
  vout: number
  status: 'encrypted' | 'decrypted'
  eventType: 'upload' | 'decrypted'
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
  type?: 'audit' | 'inbox' | 'audit-events' | 'file-views'
  contentHash?: string
  uhrpUrl?: string
  txid?: string
}

/** Ensure a value is a plain string — blocks NoSQL injection via objects/arrays */
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
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
  private auditEvents: Collection

  constructor(db: Db) {
    this.collection = db.collection<MedicalTokenDoc>('medical_tokens')
    this.auditEvents = db.collection('audit_events')
  }

  async query(query: LookupQuery): Promise<LookupResult> {
    const identityKey = str(query.identityKey)
    const txid = str(query.txid)
    const recipientKey = str(query.recipientKey)
    const senderKey = str(query.senderKey)
    const contentHash = str(query.contentHash)
    const status = str(query.status)

    if (query.type === 'audit-events' && identityKey) {
      return this.queryAuditEvents(identityKey)
    }

    if (query.type === 'file-views' && txid) {
      return this.queryFileViews(txid)
    }

    const filter: Filter<MedicalTokenDoc> = {}

    if (query.type === 'audit' && identityKey) {
      // Audit: all tokens where user is sender OR recipient
      filter.$or = [
        { senderKey: identityKey },
        { recipientKey: identityKey },
      ]
    } else if (recipientKey) {
      filter.recipientKey = recipientKey
      if (status === 'encrypted' || status === 'decrypted') {
        filter.status = status
      }
    } else if (senderKey) {
      filter.senderKey = senderKey
    } else if (contentHash) {
      filter.contentHash = contentHash
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

  private async queryFileViews(txid: string): Promise<LookupResult> {
    const docs = await this.auditEvents
      .find({
        txid,
        event: { $in: ['access', 'view'] },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    return {
      type: 'output-list',
      outputs: docs.map((doc) => ({
        txid: doc.txid || '',
        outputIndex: 0,
        outputScript: '',
        event: doc.event,
        accessedBy: doc.accessedBy || doc.recipientKey || '',
        recipientKey: doc.recipientKey || '',
        timestamp: doc.createdAt ? new Date(doc.createdAt).getTime() : 0,
      })),
    }
  }

  private async queryAuditEvents(identityKey: string): Promise<LookupResult> {
    const docs = await this.auditEvents
      .find({
        $or: [
          { senderKey: identityKey },
          { recipientKey: identityKey },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()

    return {
      type: 'output-list',
      outputs: docs.map((doc) => ({
        txid: doc.txid || '',
        outputIndex: 0,
        outputScript: '',
        event: doc.event,
        senderKey: doc.senderKey || '',
        recipientKey: doc.recipientKey || '',
        accessedBy: doc.accessedBy || '',
        uhrpUrl: doc.uhrpUrl || '',
        contentHash: doc.contentHash || '',
        keyID: doc.keyID || '',
        metadata: doc.metadata || {},
        timestamp: doc.createdAt ? new Date(doc.createdAt).getTime() : 0,
      })),
    }
  }
}
