import type { Db, Collection } from 'mongodb'
import { Transaction } from '@bsv/sdk'

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

const PROTOCOL_PREFIX = 'p2p identity'

export class IdentityTopicManager {
  private collection: Collection<IdentityDoc>

  constructor(db: Db) {
    this.collection = db.collection<IdentityDoc>('identities')
  }

  async processTransaction(txHex: string): Promise<void> {
    const outputs = this.parseOutputs(txHex)

    for (const output of outputs) {
      await this.onOutputAdded(output)
    }
  }

  private async onOutputAdded(output: {
    txid: string
    vout: number
    fields: string[]
  }): Promise<void> {
    const [prefix, identityKey, name, role, timestampStr] = output.fields

    if (prefix !== PROTOCOL_PREFIX) return
    if (role !== 'patient' && role !== 'doctor') return

    // Enforce one role per identityKey
    const existing = await this.collection.findOne({ identityKey })

    if (existing && existing.role !== role) {
      console.warn(`Role mismatch rejected: ${identityKey.slice(0, 8)}... is ${existing.role}, tried ${role}`)
      return
    }

    if (existing) {
      await this.collection.updateOne(
        { identityKey },
        {
          $set: {
            name,
            txid: output.txid,
            vout: output.vout,
            registeredAt: parseInt(timestampStr || '0'),
            updatedAt: new Date(),
          },
        },
      )
    } else {
      await this.collection.insertOne({
        txid: output.txid,
        vout: output.vout,
        identityKey,
        name,
        role,
        registeredAt: parseInt(timestampStr || '0'),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    console.log(`Identity registered: ${name} (${role}) ${identityKey.slice(0, 8)}...`)
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

        // Identity PushDrop: 5 fields + optional signature = 5-6 pushes minimum
        if (dataPushes.length < 5) continue

        // Decode first 5 fields as UTF-8 strings
        const fields = dataPushes.slice(0, 5).map((d) => decoder.decode(d))

        // Check protocol prefix
        if (fields[0] !== PROTOCOL_PREFIX) continue

        results.push({ txid, vout, fields })
      }

      return results
    } catch (err) {
      console.error('Failed to parse identity outputs:', err)
      return []
    }
  }
}
