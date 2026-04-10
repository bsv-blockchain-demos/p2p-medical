import {
  WalletClient, StorageUploader, StorageDownloader, StorageUtils,
  PushDrop, Transaction, TopicBroadcaster, Utils,
  type SecurityLevel,
} from '@bsv/sdk'

function getProviders(): string[] {
  const raw = import.meta.env.VITE_UHRP_PROVIDERS as string | undefined
  // TODO: re-enable nanostore once Go UHRP validation is complete
  // if (!raw) return ['https://go-uhrp-us-1.bsvblockchain.tech', 'https://nanostore.babbage.systems']
  if (!raw) return ['https://go-uhrp-us-1.bsvblockchain.tech']
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface UhrpUploadResult {
  uhrpUrl: string
  cdnUrl?: string
  providerCount: number
  providerUrls: string[]
  retentionExpiry: number
  confirmedSize: number
}

/**
 * Resolve the CDN URL for a UHRP file via the authenticated findFile endpoint.
 * Only the original uploader can call this (requires sender's wallet auth).
 */
export async function resolveCdnUrl(uhrpUrl: string): Promise<string | undefined> {
  const wallet = new WalletClient()
  const providers = getProviders()

  for (const providerUrl of providers) {
    try {
      const uploader = new StorageUploader({ wallet, storageURL: providerUrl })
      const fileData = await uploader.findFile(uhrpUrl)
      if (fileData.name) {
        // Normalize: Go UHRP returns "abc123", nanostore returns "cdn/abc123"
        const objectId = fileData.name.startsWith('cdn/') ? fileData.name.slice(4) : fileData.name
        return `${providerUrl}/cdn/${objectId}`
      }
    } catch (err) {
      console.debug(`[resolveCdnUrl] ${providerUrl} failed:`, err)
    }
  }

  console.warn('[resolveCdnUrl] All providers failed for', uhrpUrl)
  return undefined
}

export async function uploadToUHRP(
  encryptedData: Uint8Array,
  mimeType: string,
  retentionPeriod: number = 525600, // default 1 year in minutes
  providers?: string[],
): Promise<UhrpUploadResult> {
  const wallet = new WalletClient()
  if (!providers || providers.length === 0) providers = getProviders()
  console.debug('[UHRP] Uploading to providers:', providers)

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

  // Collect URLs of providers that succeeded
  const providerUrls = providers.filter((_, i) => results[i].status === 'fulfilled')

  // Resolve CDN URL via findFile (sender has auth, can look up the object identifier)
  const cdnUrl = await resolveCdnUrl(uhrpUrl)

  return {
    uhrpUrl,
    cdnUrl,
    providerCount: fulfilled.length,
    providerUrls,
    retentionExpiry,
    confirmedSize,
  }
}

/**
 * Mint and broadcast a UHRP hosting advertisement to the public overlay.
 * This makes the file discoverable via StorageDownloader.resolve() and third-party UHRP UIs.
 * Must be called by the original uploader (sender's wallet signs the advertisement).
 */
export async function publishUhrpAdvertisement(
  uhrpUrl: string,
  cdnUrl: string,
  fileSizeBytes: number,
  retentionExpiryMs: number,
): Promise<void> {
  const wallet = new WalletClient()
  const pushDrop = new PushDrop(wallet)

  // Get sender's identity key (hex)
  const { publicKey: identityKey } = await wallet.getPublicKey({ identityKey: true })

  // Extract SHA-256 hash from UHRP URL (32 bytes)
  const hash = StorageUtils.getHashFromURL(uhrpUrl)

  // Encode varint fields
  const expirySeconds = Math.floor(retentionExpiryMs / 1000)
  const expiryBytes = Utils.Writer.varIntNum(expirySeconds)
  const sizeBytes = Utils.Writer.varIntNum(fileSizeBytes)

  // UHRP advertisement PushDrop fields (matches tm_uhrp topic manager)
  const fields: number[][] = [
    Array.from(Utils.toArray(identityKey, 'hex')),  // [0] host identity key
    Array.from(hash),                                // [1] SHA-256 hash (32 bytes)
    Array.from(Utils.toArray(cdnUrl, 'utf8')),       // [2] hosted file URL
    expiryBytes,                                     // [3] expiry time (varint, unix seconds)
    sizeBytes,                                       // [4] file size (varint, bytes)
  ]

  const lockingScript = await pushDrop.lock(
    fields,
    [2 as SecurityLevel, 'uhrp advertisement'],
    '1',
    'anyone',
  )

  const result = await wallet.createAction({
    description: 'UHRP hosting advertisement',
    outputs: [{
      lockingScript: lockingScript.toHex(),
      satoshis: 1,
      outputDescription: 'UHRP advertisement',
      basket: 'uhrp_advertisements',
      tags: ['uhrp advertisement'],
    }],
  })

  if (result.tx) {
    const tx = Transaction.fromAtomicBEEF(result.tx)
    const broadcaster = new TopicBroadcaster(['tm_uhrp'], { networkPreset: 'mainnet' })
    const broadcastResult = await broadcaster.broadcast(tx)
    const status = broadcastResult?.status || broadcastResult
    if (status === 'success') {
      console.log('[UHRP ad] Broadcast succeeded')
    } else {
      console.debug('[UHRP ad] Broadcast result (expected on mainnet):', status)
    }
  }
}

export async function downloadFromUHRP(
  uhrpUrl: string,
  cdnUrl?: string,
): Promise<Uint8Array> {
  const errors: string[] = []

  // Strategy 1: SDK StorageDownloader (overlay resolution → CDN fetch with hash check)
  try {
    const downloader = new StorageDownloader({ networkPreset: 'mainnet' })
    const response = await downloader.download(uhrpUrl)
    return response.data
  } catch (sdkErr) {
    const msg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr)
    errors.push(`SDK: ${msg}`)
    console.warn('SDK download failed:', msg)
  }

  // Strategy 2: Direct fetch from CDN URL (stored at upload time, public GCS)
  if (cdnUrl) {
    try {
      const res = await fetch(cdnUrl)
      if (res.ok) {
        const data = new Uint8Array(await res.arrayBuffer())
        if (verifyContentHash(data, uhrpUrl)) {
          return data
        }
        errors.push('CDN: hash mismatch')
        console.warn('CDN download hash mismatch — file may be corrupted')
      } else {
        errors.push(`CDN: HTTP ${res.status}`)
      }
    } catch (cdnErr) {
      const msg = cdnErr instanceof Error ? cdnErr.message : String(cdnErr)
      errors.push(`CDN: ${msg}`)
      console.warn('CDN download failed:', msg)
    }
  }

  throw new Error(`All download strategies failed: ${errors.join('; ')}`)
}

/**
 * Verify downloaded bytes match the UHRP URL's SHA-256 hash.
 * Re-hashes the data and compares against the hash encoded in the UHRP URL.
 */
function verifyContentHash(data: Uint8Array, uhrpUrl: string): boolean {
  try {
    const actualUrl = 'uhrp://' + StorageUtils.getURLForFile(data)
    return actualUrl === uhrpUrl
  } catch {
    return false
  }
}
