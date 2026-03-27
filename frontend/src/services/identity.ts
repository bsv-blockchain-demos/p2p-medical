import type { SecurityLevel } from '@bsv/sdk'
import { PushDrop, Transaction } from '@bsv/sdk'
import { getWallet } from './wallet'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const PROTOCOL_PREFIX = 'p2p identity'
const PROTOCOL_ID: [SecurityLevel, string] = [1 as SecurityLevel, PROTOCOL_PREFIX]
const TOPIC = 'tm_identity'
const BASKET = 'identity_tokens'

export interface UserProfile {
  name: string
  role: 'patient' | 'doctor'
  identityKey: string
}

export interface IdentityResult {
  name: string
  publicKey: string
  role: string
}

export async function fetchProfile(identityKey: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/identity/profile?key=${encodeURIComponent(identityKey)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data || null
  } catch {
    return null
  }
}

export async function registerIdentity(
  name: string,
  role: 'patient' | 'doctor',
): Promise<void> {
  const wallet = getWallet()
  const { publicKey: identityKey } = await wallet.getPublicKey({ identityKey: true })

  // Register directly via API (always works)
  const registerRes = await fetch(`${API_BASE}/api/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityKey, name, role }),
  })
  if (!registerRes.ok) {
    const data = await registerRes.json().catch(() => null)
    throw new Error(data?.error || 'Failed to register identity')
  }

  // Try on-chain registration in the background (non-blocking)
  try {
    const pushDrop = new PushDrop(wallet)
    const encoder = new TextEncoder()
    const fields = [
      Array.from(encoder.encode(PROTOCOL_PREFIX)),
      Array.from(encoder.encode(identityKey)),
      Array.from(encoder.encode(name)),
      Array.from(encoder.encode(role)),
      Array.from(encoder.encode(String(Date.now()))),
    ]

    const lockingScript = await pushDrop.lock(
      fields,
      PROTOCOL_ID,
      identityKey,
      'self',
    )

    const result = await wallet.createAction({
      description: `Register identity: ${name} (${role})`,
      outputs: [
        {
          lockingScript: lockingScript.toHex(),
          satoshis: 1,
          outputDescription: 'Identity registration token',
          basket: BASKET,
          tags: [PROTOCOL_PREFIX, role],
        },
      ],
    })

    if (result.tx) {
      const tx = Transaction.fromAtomicBEEF(result.tx)
      await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: tx.toHex(),
          topics: [TOPIC],
        }),
      })
    }
  } catch (err) {
    console.warn('On-chain registration skipped:', err)
  }
}

export async function searchIdentity(query: string, role?: string): Promise<IdentityResult[]> {
  try {
    let url = `${API_BASE}/api/identity/search?q=${encodeURIComponent(query)}`
    if (role) {
      url += `&role=${encodeURIComponent(role)}`
    }
    const res = await fetch(url)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function deleteProfile(identityKey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/identity/profile`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityKey }),
  })
  if (!res.ok) throw new Error('Failed to delete profile')
}

export function isValidPublicKey(key: string): boolean {
  return /^(02|03)[a-fA-F0-9]{64}$/.test(key)
}
