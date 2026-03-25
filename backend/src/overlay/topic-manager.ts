import type { Db, Collection } from 'mongodb'

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
  metadata: {
    fileType: string
    bodyPart?: string
    fileName?: string
    mimeType: string
    fileSizeBytes: number
  }
  keyID: string
  timestamp: number
  spendTxid: string | null
  accessedAt: number | null
  originalTxid: string | null
  createdAt: Date
  updatedAt: Date
}

const PROTOCOL_PREFIX = 'p2p-medical'

export class MedicalTokenTopicManager {
  private collection: Collection<MedicalTokenDoc>

  constructor(db: Db) {
    this.collection = db.collection<MedicalTokenDoc>('medical_tokens')
  }

  async processTransaction(txHex: string): Promise<void> {
    // Decode the transaction and extract PushDrop outputs
    // In a real implementation, this would use @bsv/sdk Transaction.fromHex
    // and PushDrop.decode to parse each output
    const outputs = this.parseOutputs(txHex)
    const inputs = this.parseInputs(txHex)

    // Process spent inputs (onOutputSpent)
    for (const input of inputs) {
      await this.onOutputSpent(input.prevTxid, input.prevVout, input.spendTxid)
    }

    // Process new outputs (onOutputAdded)
    for (const output of outputs) {
      await this.onOutputAdded(output)
    }
  }

  private async onOutputAdded(output: {
    txid: string
    vout: number
    fields: string[]
  }): Promise<void> {
    const [prefix, eventType, contentHash, uhrpUrl, senderKey, recipientKey, metadataStr, keyID, timestampStr] =
      output.fields

    if (prefix !== PROTOCOL_PREFIX) return

    const metadata = JSON.parse(metadataStr || '{}')
    const timestamp = parseInt(timestampStr || '0')

    const doc: MedicalTokenDoc = {
      txid: output.txid,
      vout: output.vout,
      status: eventType === 'upload' ? 'pending' : 'receipt',
      eventType: eventType as 'upload' | 'accessed',
      protocolPrefix: prefix,
      contentHash,
      uhrpUrl,
      senderKey,
      recipientKey,
      metadata,
      keyID,
      timestamp,
      spendTxid: null,
      accessedAt: null,
      originalTxid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.collection.updateOne(
      { txid: output.txid, vout: output.vout },
      { $set: doc },
      { upsert: true },
    )

    console.log(`Token added: ${eventType} ${output.txid}:${output.vout}`)
  }

  private async onOutputSpent(
    prevTxid: string,
    prevVout: number,
    spendTxid: string,
  ): Promise<void> {
    const result = await this.collection.updateOne(
      { txid: prevTxid, vout: prevVout },
      {
        $set: {
          status: 'accessed',
          spendTxid,
          accessedAt: Date.now(),
          updatedAt: new Date(),
        },
      },
    )

    if (result.modifiedCount > 0) {
      console.log(`Token spent: ${prevTxid}:${prevVout} by ${spendTxid}`)
    }
  }

  private parseOutputs(txHex: string): Array<{ txid: string; vout: number; fields: string[] }> {
    // TODO: Real implementation would use @bsv/sdk Transaction.fromHex()
    // and PushDrop.decode() on each output to extract fields.
    // For now, this is a placeholder that the overlay-express integration
    // would handle automatically.
    return []
  }

  private parseInputs(txHex: string): Array<{ prevTxid: string; prevVout: number; spendTxid: string }> {
    // TODO: Same as above — real implementation parses tx inputs
    return []
  }
}
