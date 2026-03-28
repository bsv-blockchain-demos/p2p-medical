import type { Db, Collection } from 'mongodb'
import { Transaction } from '@bsv/sdk'

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

const PROTOCOL_PREFIX = 'p2p medical'

export class MedicalTokenTopicManager {
  private collection: Collection<MedicalTokenDoc>

  constructor(db: Db) {
    this.collection = db.collection<MedicalTokenDoc>('medical_tokens')
  }

  async processTransaction(txHex: string): Promise<void> {
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
      status: eventType === 'upload' ? 'encrypted' : 'decrypted',
      eventType: eventType as 'upload' | 'decrypted',
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
          status: 'decrypted',
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
    try {
      const tx = Transaction.fromHex(txHex)
      const txid = tx.id('hex')
      const results: Array<{ txid: string; vout: number; fields: string[] }> = []
      const decoder = new TextDecoder()

      for (let vout = 0; vout < tx.outputs.length; vout++) {
        const script = tx.outputs[vout].lockingScript
        if (!script) continue

        const chunks = script.chunks

        // Collect data pushes before the first OP_DROP (0x75) or OP_2DROP (0x6d)
        const dataPushes: Uint8Array[] = []
        for (const chunk of chunks) {
          if (chunk.op === 0x75 || chunk.op === 0x6d) break
          if (chunk.data && chunk.data.length > 0) {
            dataPushes.push(
              chunk.data instanceof Uint8Array
                ? chunk.data
                : new Uint8Array(chunk.data),
            )
          }
        }

        // PushDrop with signature: 9 fields + 1 signature = 10 pushes minimum
        // Without signature: 9 fields minimum
        if (dataPushes.length < 9) continue

        // Decode first 9 fields as UTF-8 strings
        const fields = dataPushes.slice(0, 9).map((d) => decoder.decode(d))

        // Check protocol prefix
        if (fields[0] !== PROTOCOL_PREFIX) continue

        results.push({ txid, vout, fields })
      }

      return results
    } catch (err) {
      console.error('Failed to parse outputs:', err)
      return []
    }
  }

  private parseInputs(txHex: string): Array<{ prevTxid: string; prevVout: number; spendTxid: string }> {
    try {
      const tx = Transaction.fromHex(txHex)
      const spendTxid = tx.id('hex')

      return tx.inputs
        .filter((input) => input.sourceTXID)
        .map((input) => ({
          prevTxid: input.sourceTXID!,
          prevVout: input.sourceOutputIndex ?? 0,
          spendTxid,
        }))
    } catch (err) {
      console.error('Failed to parse inputs:', err)
      return []
    }
  }
}
