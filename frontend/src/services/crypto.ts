import type { SecurityLevel } from '@bsv/sdk'
import { getWallet } from './wallet'

const PROTOCOL_ID: [SecurityLevel, string] = [1 as SecurityLevel, 'p2p-medical']

export async function encryptForRecipient(
  plaintext: Uint8Array,
  recipientPubKey: string,
  keyID: string,
): Promise<Uint8Array> {
  const wallet = getWallet()
  const { ciphertext } = await wallet.encrypt({
    plaintext: Array.from(plaintext),
    protocolID: PROTOCOL_ID,
    keyID,
    counterparty: recipientPubKey,
  })
  return new Uint8Array(ciphertext)
}

export async function decryptFromSender(
  ciphertext: Uint8Array,
  senderPubKey: string,
  keyID: string,
): Promise<Uint8Array> {
  const wallet = getWallet()
  const { plaintext } = await wallet.decrypt({
    ciphertext: Array.from(ciphertext),
    protocolID: PROTOCOL_ID,
    keyID,
    counterparty: senderPubKey,
  })
  return new Uint8Array(plaintext)
}

export async function hashContent(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
