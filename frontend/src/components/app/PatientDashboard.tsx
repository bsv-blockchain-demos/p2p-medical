import { useState, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import RecipientSearch from './RecipientSearch'
import ImageUpload from './ImageUpload'
import UploadProgress from './UploadProgress'
import { encryptForRecipient, hashContent } from '@/services/crypto'
import { uploadToUHRP } from '@/services/storage'
import { mintUploadToken, type MedicalTokenFields } from '@/services/tokens'
import { notifyRecipient } from '@/services/messagebox'
import { getIdentityKey } from '@/services/wallet'
import { formatTimestamp } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send } from 'lucide-react'

export type UploadStep =
  | 'idle'
  | 'encrypting'
  | 'uploading'
  | 'minting'
  | 'notifying'
  | 'done'
  | 'error'

export interface UploadResult {
  txid: string
  uhrpUrl: string
  recipientKey: string
  timestamp: number
}

export interface FileMetadata {
  fileType: 'xray' | 'scan' | 'report' | 'other'
  bodyPart: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
}

export default function PatientDashboard() {
  const { identityKey } = useWallet()
  const [recipientKey, setRecipientKey] = useState<string | null>(null)
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<FileMetadata>({
    fileType: 'xray',
    bodyPart: '',
    fileName: '',
    mimeType: '',
    fileSizeBytes: 0,
  })
  const [step, setStep] = useState<UploadStep>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelectRecipient = useCallback((key: string, name?: string) => {
    setRecipientKey(key)
    setRecipientName(name || null)
  }, [])

  const handleFileSelect = useCallback((f: File, meta: FileMetadata) => {
    setFile(f)
    setMetadata(meta)
  }, [])

  const handleSend = async () => {
    if (!file || !recipientKey || !identityKey) return

    setStep('encrypting')
    setError(null)
    setResult(null)

    try {
      // 1. Read file as bytes
      const fileBytes = new Uint8Array(await file.arrayBuffer())

      // 2. Generate unique keyID for encryption key derivation
      const keyID = crypto.randomUUID()

      // 3. Encrypt for recipient
      setStep('encrypting')
      const ciphertext = await encryptForRecipient(fileBytes, recipientKey, keyID)

      // 4. Hash ciphertext for integrity verification (recipient hashes downloaded ciphertext)
      const contentHash = await hashContent(ciphertext)

      // 5. Upload encrypted file to UHRP
      setStep('uploading')
      const uhrpUrl = await uploadToUHRP(ciphertext, 'application/octet-stream')

      // 5. Mint PushDrop token
      setStep('minting')
      const senderKey = await getIdentityKey()
      const tokenFields: MedicalTokenFields = {
        eventType: 'upload',
        contentHash,
        uhrpUrl,
        senderKey,
        recipientKey: recipientKey,
        metadata: {
          fileType: metadata.fileType,
          bodyPart: metadata.bodyPart || undefined,
          fileName: metadata.fileName || undefined,
          mimeType: metadata.mimeType,
          fileSizeBytes: metadata.fileSizeBytes,
        },
        keyID,
      }
      const mintResult = await mintUploadToken(tokenFields)

      // 6. Notify recipient via MessageBox
      setStep('notifying')
      const txid = mintResult.txid || ''
      await notifyRecipient(recipientKey, {
        uhrpUrl,
        contentHash,
        tokenTxid: txid,
        senderKey,
        metadata: tokenFields.metadata,
      })

      setStep('done')
      setResult({
        txid,
        uhrpUrl,
        recipientKey: recipientKey,
        timestamp: Date.now(),
      })
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const canSend = !!recipientKey && !!file && step === 'idle'

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Share Medical Image</h2>

      <RecipientSearch onSelect={handleSelectRecipient} selectedKey={recipientKey} selectedName={recipientName} />

      <ImageUpload onFileSelect={handleFileSelect} file={file} metadata={metadata} />

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleSend}
          disabled={!canSend}
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          Send Securely
        </Button>
      </div>

      {step !== 'idle' && (
        <UploadProgress step={step} error={error} />
      )}

      {result && (
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="text-violet-500 dark:text-violet-400 text-lg">Success</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium dark:text-slate-400 text-slate-500">Txid:</span>{' '}
              <span className="font-mono text-violet-500 dark:text-violet-300/70">{result.txid}</span>
            </div>
            <div>
              <span className="font-medium dark:text-slate-400 text-slate-500">UHRP:</span>{' '}
              <span className="font-mono text-xs text-violet-500 dark:text-violet-300/70">{result.uhrpUrl}</span>
            </div>
            <div>
              <span className="font-medium dark:text-slate-400 text-slate-500">To:</span>{' '}
              <span className="font-mono text-violet-500 dark:text-violet-300/70">{recipientName || result.recipientKey}</span>
            </div>
            <div>
              <span className="font-medium dark:text-slate-400 text-slate-500">Time:</span>{' '}
              {formatTimestamp(result.timestamp)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
