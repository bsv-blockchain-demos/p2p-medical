import { WalletClient, StorageUploader, StorageDownloader } from '@bsv/sdk'

const LEGACY_UHRP_URL = import.meta.env.VITE_UHRP_URL || 'http://localhost:3002'

function getProviders(): string[] {
  const raw = import.meta.env.VITE_UHRP_PROVIDERS as string | undefined
  if (!raw) return ['https://nanostore.babbage.systems']
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface UhrpUploadResult {
  uhrpUrl: string
  providerCount: number
  retentionExpiry: number
  confirmedSize: number
}

export async function uploadToUHRP(
  encryptedData: Uint8Array,
  mimeType: string,
  retentionPeriod: number = 525600, // default 1 year in minutes
): Promise<UhrpUploadResult> {
  const wallet = new WalletClient()
  const providers = getProviders()

  const results = await Promise.allSettled(
    providers.map(async (storageURL) => {
      const uploader = new StorageUploader({ wallet, storageURL })
      return uploader.publishFile({
        file: { data: Array.from(encryptedData), type: mimeType },
        retentionPeriod,
      })
    }),
  )

  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<Awaited<ReturnType<StorageUploader['publishFile']>>> =>
      r.status === 'fulfilled',
  )

  if (fulfilled.length === 0) {
    const reasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason?.message || String(r.reason))
    throw new Error(`All UHRP providers failed: ${reasons.join('; ')}`)
  }

  const first = fulfilled[0].value
  const uhrpUrl = first.uhrpURL
  const confirmedSize = encryptedData.byteLength
  const retentionExpiry = Date.now() + retentionPeriod * 60 * 1000

  return {
    uhrpUrl,
    providerCount: fulfilled.length,
    retentionExpiry,
    confirmedSize,
  }
}

export async function downloadFromUHRP(
  uhrpUrl: string,
): Promise<Uint8Array> {
  // Primary: SDK StorageDownloader (resolves via overlay network)
  try {
    const downloader = new StorageDownloader()
    const response = await downloader.download(uhrpUrl)
    return response.data
  } catch (sdkErr) {
    console.warn('SDK download failed, trying legacy fallback:', sdkErr)
  }

  // Fallback: direct fetch from legacy MinIO-backed server
  const hash = uhrpUrl.replace('uhrp://', '')
  const res = await fetch(`${LEGACY_UHRP_URL}/download/${hash}`)
  if (!res.ok) {
    throw new Error(`UHRP download failed: ${res.status} ${res.statusText}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}
