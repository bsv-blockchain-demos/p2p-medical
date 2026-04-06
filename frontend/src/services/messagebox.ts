import { MessageBoxClient } from '@bsv/message-box-client'
import { Utils } from '@bsv/sdk'
import { getWallet } from './wallet'

const MESSAGE_BOX_HOSTS = [
  'https://message-box-eu-1.bsvb.tech',
  'https://message-box-us-1.bsvb.tech',
  'https://message-box-ap-1.bsvb.tech',
]

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
  const wallet = getWallet()
  const body = Utils.toBase64(Utils.toArray(JSON.stringify(notification), 'utf8'))

  for (const host of MESSAGE_BOX_HOSTS) {
    try {
      const mbc = new MessageBoxClient({ host, walletClient: wallet })
      await mbc.sendMessage({ body, recipient: recipientKey, messageBox: 'medical_images' }, host)
      return
    } catch (err) {
      console.warn(`MessageBox ${host} failed:`, err)
    }
  }
  throw new Error('All MessageBox providers failed')
}
