import type { SecurityLevel, CreateActionResult } from '@bsv/sdk'
import { getWallet } from './wallet'
import {
  PushDrop,
  SHIPBroadcaster,
  LookupResolver,
  Transaction,
} from '@bsv/sdk'

const PROTOCOL_PREFIX = 'p2p-medical'
const PROTOCOL_ID: [SecurityLevel, string] = [1 as SecurityLevel, PROTOCOL_PREFIX]
const TOPIC = 'tm_medical_token'
const LOOKUP_SERVICE = 'ls_medical_token'
const BASKET = 'medical_tokens'

export interface MedicalTokenFields {
  eventType: 'upload' | 'accessed'
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
}

export interface MedicalToken extends MedicalTokenFields {
  txid: string
  vout: number
  status: 'pending' | 'accessed' | 'receipt'
  timestamp: number
}

function encodeFields(fields: MedicalTokenFields): number[][] {
  const encoder = new TextEncoder()
  return [
    Array.from(encoder.encode(PROTOCOL_PREFIX)),
    Array.from(encoder.encode(fields.eventType)),
    Array.from(encoder.encode(fields.contentHash)),
    Array.from(encoder.encode(fields.uhrpUrl)),
    Array.from(encoder.encode(fields.senderKey)),
    Array.from(encoder.encode(fields.recipientKey)),
    Array.from(encoder.encode(JSON.stringify(fields.metadata))),
    Array.from(encoder.encode(fields.keyID)),
    Array.from(encoder.encode(String(Date.now()))),
  ]
}

export async function mintUploadToken(
  fields: MedicalTokenFields,
): Promise<CreateActionResult> {
  const wallet = getWallet()
  const pushDrop = new PushDrop(wallet)

  const lockingScript = await pushDrop.lock(
    encodeFields(fields),
    PROTOCOL_ID,
    fields.contentHash, // keyID
    fields.recipientKey, // counterparty
  )

  const result = await wallet.createAction({
    description: `Share medical image with doctor`,
    outputs: [
      {
        lockingScript: lockingScript.toHex(),
        satoshis: 1,
        outputDescription: 'Medical upload token',
        basket: BASKET,
        tags: ['p2p-medical', fields.metadata.fileType],
      },
    ],
  })

  // Broadcast to overlay
  if (result.tx) {
    const broadcaster = new SHIPBroadcaster([TOPIC], { networkPreset: 'local' })
    const tx = Transaction.fromAtomicBEEF(result.tx)
    await broadcaster.broadcast(tx)
  }

  return result
}

export async function spendTokenAndMintReceipt(
  uploadTxid: string,
  uploadVout: number,
  uploadFields: MedicalTokenFields,
): Promise<CreateActionResult> {
  const wallet = getWallet()
  const pushDrop = new PushDrop(wallet)

  const receiptFields: MedicalTokenFields = {
    ...uploadFields,
    eventType: 'accessed',
  }
  const receiptScript = await pushDrop.lock(
    encodeFields(receiptFields),
    PROTOCOL_ID,
    uploadFields.contentHash,
    uploadFields.senderKey, // counterparty is original sender
  )

  pushDrop.unlock(
    PROTOCOL_ID,
    uploadFields.contentHash,
    uploadFields.senderKey,
  )

  const result = await wallet.createAction({
    description: `Access medical image from patient`,
    inputs: [
      {
        outpoint: `${uploadTxid}.${uploadVout}`,
        inputDescription: 'Spend upload token (access proof)',
        unlockingScriptLength: 73,
      },
    ],
    outputs: [
      {
        lockingScript: receiptScript.toHex(),
        satoshis: 1,
        outputDescription: 'Access receipt token',
        basket: 'medical_receipts',
        tags: ['p2p-medical', 'receipt'],
      },
    ],
  })

  if (result.tx) {
    const broadcaster = new SHIPBroadcaster([TOPIC], { networkPreset: 'local' })
    const tx = Transaction.fromAtomicBEEF(result.tx)
    await broadcaster.broadcast(tx)
  }

  return result
}

export async function queryPendingTokens(
  recipientKey: string,
): Promise<MedicalToken[]> {
  const resolver = new LookupResolver()
  const result = await resolver.query({
    service: LOOKUP_SERVICE,
    query: {
      recipientKey,
      status: 'pending',
    },
  })

  if (result.type !== 'output-list' || !result.outputs) return []

  return result.outputs.map((output) => {
    // Each output has beef + outputIndex
    // In a full implementation we'd decode the script from the BEEF
    return {
      eventType: 'upload' as const,
      contentHash: '',
      uhrpUrl: '',
      senderKey: '',
      recipientKey,
      metadata: { fileType: 'other', mimeType: 'application/octet-stream', fileSizeBytes: 0 },
      keyID: '',
      txid: '',
      vout: output.outputIndex,
      status: 'pending' as const,
      timestamp: Date.now(),
    }
  })
}

export async function queryAuditTrail(
  identityKey: string,
): Promise<MedicalToken[]> {
  const resolver = new LookupResolver()
  const result = await resolver.query({
    service: LOOKUP_SERVICE,
    query: {
      identityKey,
      type: 'audit',
    },
  })

  if (result.type !== 'output-list' || !result.outputs) return []

  return result.outputs.map((output) => ({
    eventType: 'upload' as const,
    contentHash: '',
    uhrpUrl: '',
    senderKey: '',
    recipientKey: '',
    metadata: { fileType: 'other', mimeType: 'application/octet-stream', fileSizeBytes: 0 },
    keyID: '',
    txid: '',
    vout: output.outputIndex,
    status: 'pending' as const,
    timestamp: Date.now(),
  }))
}
