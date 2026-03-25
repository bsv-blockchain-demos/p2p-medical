import { getWallet } from './wallet'
import { StorageUploader, StorageDownloader } from '@bsv/sdk'

const UHRP_SERVER_URL = import.meta.env.VITE_UHRP_URL || 'http://localhost:3002'

export async function uploadToUHRP(
  encryptedData: Uint8Array,
  _mimeType: string,
): Promise<string> {
  const wallet = getWallet()
  const uploader = new StorageUploader({
    storageURL: UHRP_SERVER_URL,
    wallet,
  })

  const result = await uploader.publishFile({
    file: {
      data: encryptedData,
      type: 'application/octet-stream',
    },
    retentionPeriod: 525600, // ~1 year in minutes
  })

  return result.uhrpURL
}

export async function downloadFromUHRP(
  uhrpUrl: string,
): Promise<Uint8Array> {
  const downloader = new StorageDownloader({ networkPreset: 'local' })
  const result = await downloader.download(uhrpUrl)
  return result.data
}
