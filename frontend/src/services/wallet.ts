import { WalletClient } from '@bsv/sdk'

const SESSION_KEY = 'wallet_connected'

let walletClient: WalletClient | null = null

export async function connectWallet(): Promise<WalletClient> {
  if (walletClient) return walletClient
  walletClient = new WalletClient()
  // Verify connection by fetching public key
  await walletClient.getPublicKey({ identityKey: true })
  sessionStorage.setItem(SESSION_KEY, '1')
  return walletClient
}

/**
 * Attempt to reconnect after a page refresh.
 * Creates a fresh WalletClient and verifies the wallet substrate is still available.
 */
export async function tryReconnect(): Promise<boolean> {
  if (walletClient) return true
  try {
    const wc = new WalletClient()
    await wc.getPublicKey({ identityKey: true })
    walletClient = wc
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return false
  }
}

export function hadPriorSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function getWallet(): WalletClient {
  if (!walletClient) throw new Error('Wallet not connected')
  return walletClient
}

export async function getIdentityKey(): Promise<string> {
  const wallet = getWallet()
  const { publicKey } = await wallet.getPublicKey({ identityKey: true })
  return publicKey
}

export function disconnectWallet(): void {
  walletClient = null
  sessionStorage.removeItem(SESSION_KEY)
}

export async function isWalletConnected(): Promise<boolean> {
  try {
    if (!walletClient) return false
    await walletClient.getPublicKey({ identityKey: true })
    return true
  } catch {
    walletClient = null
    return false
  }
}
