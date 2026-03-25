const API_BASE = import.meta.env.VITE_API_URL || ''

export interface IdentityResult {
  name: string
  publicKey: string
}

export async function searchIdentity(query: string): Promise<IdentityResult[]> {
  try {
    const res = await fetch(`${API_BASE}/api/identity/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export function isValidPublicKey(key: string): boolean {
  return /^(02|03)[a-fA-F0-9]{64}$/.test(key)
}
