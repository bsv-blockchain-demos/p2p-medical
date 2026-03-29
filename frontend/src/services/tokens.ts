import type { SecurityLevel, CreateActionResult } from '@bsv/sdk'
import { getWallet } from './wallet'
import { PushDrop, Transaction } from '@bsv/sdk'

const PROTOCOL_PREFIX = 'p2p medical'
const PROTOCOL_ID: [SecurityLevel, string] = [1 as SecurityLevel, PROTOCOL_PREFIX]
const TOPIC = 'tm_medical_token'
const BASKET = 'medical_tokens'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface MedicalTokenFields {
  eventType: 'upload' | 'decrypted'
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
    retentionExpiry?: number
    providerCount?: number
  }
  keyID: string
}

export interface MedicalToken extends MedicalTokenFields {
  txid: string
  vout: number
  status: 'encrypted' | 'decrypted'
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

async function shareTokenDirect(fields: MedicalTokenFields, txid: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/tokens/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txid,
      eventType: fields.eventType,
      contentHash: fields.contentHash,
      uhrpUrl: fields.uhrpUrl,
      senderKey: fields.senderKey,
      recipientKey: fields.recipientKey,
      metadata: fields.metadata,
      keyID: fields.keyID,
    }),
  })
  if (!res.ok) {
    throw new Error(`Token share failed: ${res.status} ${res.statusText}`)
  }
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

  return result
}

export async function broadcastToken(
  fields: MedicalTokenFields,
  mintResult: CreateActionResult,
  txid: string,
): Promise<void> {
  // 1. Record to backend audit trail + doctor inbox
  if (txid) {
    await shareTokenDirect(fields, txid)
  }

  // 2. Broadcast tx to miners (ARC) + overlay network
  if (!mintResult.tx) {
    throw new Error('No transaction in mint result — cannot broadcast')
  }

  const tx = Transaction.fromAtomicBEEF(mintResult.tx)

  // 2a. Collect ALL ancestor txs from the BEEF that need broadcasting
  // Walk the full tree: any sourceTransaction without merklePath is unconfirmed
  // Collect ALL unconfirmed ancestors in topological order (parents before children)
  const ancestorMap = new Map<string, Transaction>()
  function collectAncestors(t: Transaction, depth: number) {
    for (const input of t.inputs) {
      if (input.sourceTransaction) {
        const id = input.sourceTransaction.id('hex')
        const hasMerkle = !!input.sourceTransaction.merklePath
        console.log(`  ancestor ${id.slice(0, 12)}... merkle=${hasMerkle}`)
        if (!hasMerkle && !ancestorMap.has(id)) {
          collectAncestors(input.sourceTransaction, depth + 1) // recurse deeper FIRST
          ancestorMap.set(id, input.sourceTransaction) // then add this one (topo order)
        }
      }
    }
  }
  collectAncestors(tx, 1)
  const parentHexes = [...ancestorMap.values()].map((t) => t.toHex())

  // Broadcast parents first via GorillaPool (no auth, fast), then broadcast our tx
  // This ensures nodes have the parent UTXOs before seeing the child tx
  const broadcastRawToArc = async (hex: string, label: string) => {
    try {
      const res = await fetch('https://arc.gorillapool.io/v1/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: hex,
      })
      const body = await res.json().catch(() => ({})) as Record<string, string>
      console.log(`${label}: ${res.status}`, body.txStatus || body.txid || '')
    } catch (err) {
      console.warn(`${label}: failed`, err)
    }
  }

  // Fire-and-forget: broadcast parents then child
  void (async () => {
    // Broadcast unconfirmed parents in topological order (deepest ancestor first)
    if (parentHexes.length > 0) {
      console.log(`Broadcasting ${parentHexes.length} ancestor tx(s)...`)
      for (let i = 0; i < parentHexes.length; i++) {
        await broadcastRawToArc(parentHexes[i], `Parent[${i}]`)
      }
    }

    // Then broadcast our tx to multiple services
    await Promise.allSettled([
      // GorillaPool ARC (BEEF binary via octet-stream)
      fetch('https://arc.gorillapool.io/v1/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(tx.toBEEF()),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({})) as Record<string, string>
        console.log(`GorillaPool BEEF: ${res.status}`, body.txStatus || body.txid || '')
      }).catch((err) => console.warn('GorillaPool: failed', err)),
      // TAAL ARC (BEEF) via backend proxy
      fetch(`${API_URL}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawTx: tx.toHexBEEF() }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({})) as Record<string, string>
        console.log(`TAAL ARC: ${res.status}`, body.txStatus || body.txid || '')
      }).catch((err) => console.warn('TAAL ARC: failed', err)),
      // WoC (raw hex — should work now that parents are broadcast)
      fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txhex: tx.toHex() }),
      }).then(async (res) => {
        if (res.ok) console.log('WoC: broadcast accepted')
        else console.warn('WoC:', res.status, await res.text().catch(() => ''))
      }).catch((err) => console.warn('WoC: failed', err)),
    ])
  })()

  // 2b. Submit to overlay network (awaited — fast, local backend)
  const overlayRes = await fetch(`${API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: tx.toHex(),
      topics: [TOPIC],
    }),
  })
  if (!overlayRes.ok) {
    const body = await overlayRes.json().catch(() => ({}))
    console.error('Overlay submit failed:', body)
  }
}

export async function confirmTokenAccess(
  uploadTxid: string,
  uploadVout: number,
  accessedBy: string,
): Promise<{ status: string; txid: string }> {
  // POC: mark as accessed via direct API (on-chain spend deferred)
  const res = await fetch(`${API_URL}/api/tokens/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid: uploadTxid, vout: uploadVout, accessedBy }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to confirm access' }))
    throw new Error(err.error || 'Failed to confirm access')
  }
  return res.json()
}

export async function recordView(
  uploadTxid: string,
  uploadVout: number,
  accessedBy: string,
): Promise<{ status: string; txid: string }> {
  const res = await fetch(`${API_URL}/api/tokens/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid: uploadTxid, vout: uploadVout, accessedBy }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to record view' }))
    throw new Error(err.error || 'Failed to record view')
  }
  return res.json()
}

export interface ViewEvent {
  accessedBy: string
  timestamp: number
  event: string
}

export async function queryFileViews(
  txid: string,
): Promise<ViewEvent[]> {
  const res = await fetch(`${API_URL}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'ls_medical_token',
      query: { txid, type: 'file-views' },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  if (data.type !== 'output-list' || !data.outputs) return []

  return data.outputs.map((output: Record<string, unknown>) => ({
    accessedBy: (output.accessedBy as string) || '',
    timestamp: (output.timestamp as number) || 0,
    event: (output.event as string) || 'view',
  }))
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
    eventType: 'decrypted',
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
      query: { recipientKey, status: 'encrypted' },
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
    status: (output.status as string) || 'encrypted',
    timestamp: (output.timestamp as number) || Date.now(),
  }))
}

export interface AuditEvent {
  event: 'upload' | 'access' | 'view'
  txid: string
  senderKey: string
  recipientKey: string
  accessedBy: string
  uhrpUrl: string
  contentHash: string
  keyID: string
  metadata: MedicalToken['metadata']
  timestamp: number
}

export async function queryAuditTrail(
  identityKey: string,
): Promise<AuditEvent[]> {
  const res = await fetch(`${API_URL}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'ls_medical_token',
      query: { identityKey, type: 'audit-events' },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  if (data.type !== 'output-list' || !data.outputs) return []

  return data.outputs.map((output: Record<string, unknown>) => ({
    event: (output.event as string) || 'upload',
    txid: (output.txid as string) || '',
    senderKey: (output.senderKey as string) || '',
    recipientKey: (output.recipientKey as string) || '',
    accessedBy: (output.accessedBy as string) || '',
    uhrpUrl: (output.uhrpUrl as string) || '',
    contentHash: (output.contentHash as string) || '',
    keyID: (output.keyID as string) || '',
    metadata: (output.metadata as MedicalToken['metadata']) || {
      fileType: 'other',
      mimeType: 'application/octet-stream',
      fileSizeBytes: 0,
    },
    timestamp: (output.timestamp as number) || Date.now(),
  }))
}

export async function resolveNames(
  keys: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = [...new Set(keys.filter(Boolean))]

  await Promise.all(
    unique.map(async (key) => {
      try {
        const res = await fetch(`${API_URL}/api/identity/profile?key=${encodeURIComponent(key)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data?.name) names.set(key, data.name)
      } catch {
        // Ignore resolution failures
      }
    }),
  )

  return names
}
