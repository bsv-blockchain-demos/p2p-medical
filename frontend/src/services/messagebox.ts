export interface MedicalNotification {
  uhrpUrl: string
  contentHash: string
  tokenTxid: string
  senderKey: string
  metadata: {
    fileType: string
    bodyPart?: string
    fileName?: string
    mimeType: string
    fileSizeBytes: number
  }
}

export async function notifyRecipient(
  recipientKey: string,
  notification: MedicalNotification,
): Promise<void> {
  const msgBoxUrl = import.meta.env.VITE_MESSAGEBOX_URL || 'http://localhost:3003'

  const body = JSON.stringify({
    recipient: recipientKey,
    messageBox: 'medical_images',
    body: JSON.stringify(notification),
  })

  await fetch(`${msgBoxUrl}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
