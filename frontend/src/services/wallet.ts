import { WalletClient } from '@bsv/sdk'

let walletClient: WalletClient | null = null

export async function connectWallet(): Promise<WalletClient> {
  if (walletClient) return walletClient
  walletClient = new WalletClient()
  // Verify connection by fetching public key
  await walletClient.getPublicKey({ identityKey: true })
  return walletClient
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
