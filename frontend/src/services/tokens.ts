import type { SecurityLevel, CreateActionResult } from '@bsv/sdk'
import { getWallet } from './wallet'
import { PushDrop, Transaction } from '@bsv/sdk'

const PROTOCOL_PREFIX = 'p2p medical'
const PROTOCOL_ID: [SecurityLevel, string] = [1 as SecurityLevel, PROTOCOL_PREFIX]
const TOPIC = 'tm_medical_token'
const BASKET = 'medical_tokens'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
    fields.contentHash, // keyID for PushDrop key derivation
    fields.recipientKey, // counterparty
  )

  const result = await wallet.createAction({
    description: `Share medical image`,
    outputs: [
      {
        lockingScript: lockingScript.toHex(),
        satoshis: 1,
        outputDescription: 'Medical upload token',
        basket: BASKET,
        tags: ['p2p medical', fields.metadata.fileType],
      },
    ],
  })

  // Submit directly to our backend overlay (bypass SHIPBroadcaster host discovery)
  if (result.tx) {
    const tx = Transaction.fromAtomicBEEF(result.tx)
    await fetch(`${API_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: tx.toHex(),
        topics: [TOPIC],
      }),
    })
  }

  return result
}

export async function spendTokenAndMintReceipt(
  uploadTxid: string,
  uploadVout: number,
  uploadFields: MedicalTokenFields,
): Promise<CreateActionResult> {
  // TODO: Full spend flow deferred for POC
  // The PushDrop unlock + receipt mint requires:
  // 1. pushDrop.unlock() → unlockingScriptTemplate
  // 2. wallet.createAction() with the template as input
  // 3. wallet.signAction() to finalize
  // For now, just mark as accessed in the overlay
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
    uploadFields.senderKey,
  )

  // TODO: Wire unlockingScriptTemplate from pushDrop.unlock() once
  // CreateActionInput supports it (requires signAction two-phase flow)
  pushDrop.unlock(
    PROTOCOL_ID,
    uploadFields.contentHash,
    uploadFields.senderKey,
  )

  const result = await wallet.createAction({
    description: `Access medical image`,
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
        tags: ['p2p medical', 'receipt'],
      },
    ],
  })

  if (result.tx) {
    const tx = Transaction.fromAtomicBEEF(result.tx)
    await fetch(`${API_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: tx.toHex(),
        topics: [TOPIC],
      }),
    })
  }

  return result
}

export async function queryPendingTokens(
  recipientKey: string,
): Promise<MedicalToken[]> {
  const res = await fetch(`${API_URL}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'ls_medical_token',
      query: { recipientKey, status: 'pending' },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  if (data.type !== 'output-list' || !data.outputs) return []

  return data.outputs.map((output: Record<string, unknown>) => ({
    eventType: (output.eventType as string) || 'upload',
    contentHash: (output.contentHash as string) || '',
    uhrpUrl: (output.uhrpUrl as string) || '',
    senderKey: (output.senderKey as string) || '',
    recipientKey: (output.recipientKey as string) || recipientKey,
    metadata: (output.metadata as MedicalToken['metadata']) || {
      fileType: 'other',
      mimeType: 'application/octet-stream',
      fileSizeBytes: 0,
    },
    keyID: (output.keyID as string) || '',
    txid: (output.txid as string) || '',
    vout: (output.outputIndex as number) ?? 0,
    status: (output.status as string) || 'pending',
    timestamp: (output.timestamp as number) || Date.now(),
  }))
}

export async function queryAuditTrail(
  identityKey: string,
): Promise<MedicalToken[]> {
  const res = await fetch(`${API_URL}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'ls_medical_token',
      query: { identityKey, type: 'audit' },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  if (data.type !== 'output-list' || !data.outputs) return []

  return data.outputs.map((output: Record<string, unknown>) => ({
    eventType: (output.eventType as string) || 'upload',
    contentHash: (output.contentHash as string) || '',
    uhrpUrl: (output.uhrpUrl as string) || '',
    senderKey: (output.senderKey as string) || '',
    recipientKey: (output.recipientKey as string) || '',
    metadata: (output.metadata as MedicalToken['metadata']) || {
      fileType: 'other',
      mimeType: 'application/octet-stream',
      fileSizeBytes: 0,
    },
    keyID: (output.keyID as string) || '',
    txid: (output.txid as string) || '',
    vout: (output.outputIndex as number) ?? 0,
    status: (output.status as string) || 'pending',
    timestamp: (output.timestamp as number) || Date.now(),
  }))
}
