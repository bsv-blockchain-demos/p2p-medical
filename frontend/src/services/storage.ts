const UHRP_SERVER_URL = import.meta.env.VITE_UHRP_URL || 'http://localhost:3002'

export async function uploadToUHRP(
  encryptedData: Uint8Array,
  _mimeType: string,
): Promise<string> {
  const formData = new FormData()
  formData.append('file', new Blob([encryptedData.buffer as ArrayBuffer]), 'encrypted.bin')

  const res = await fetch(`${UHRP_SERVER_URL}/publishFile`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`UHRP upload failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  return json.uhrpUrl || json.uhrpURL || json.hash
}

export async function downloadFromUHRP(
  uhrpUrl: string,
): Promise<Uint8Array> {
  const hash = uhrpUrl.replace('uhrp://', '')
  const res = await fetch(`${UHRP_SERVER_URL}/download/${hash}`)

  if (!res.ok) {
    throw new Error(`UHRP download failed: ${res.status} ${res.statusText}`)
  }

  return new Uint8Array(await res.arrayBuffer())
}
