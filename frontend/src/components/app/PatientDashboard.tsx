import { useState, useCallback, useRef } from 'react'
import { useWallet } from '@/context/WalletContext'
import RecipientSearch from './RecipientSearch'
import ImageUpload from './ImageUpload'
import UploadProgress from './UploadProgress'
import { encryptForRecipient, hashContent } from '@/services/crypto'
import { uploadToUHRP } from '@/services/storage'
import { mintUploadToken, broadcastToken, type MedicalTokenFields } from '@/services/tokens'
import { Transaction } from '@bsv/sdk'
import { notifyRecipient } from '@/services/messagebox'
import { getIdentityKey } from '@/services/wallet'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export type UploadStep =
  | 'idle'
  | 'encrypting'
  | 'uploading'
  | 'minting'
  | 'broadcasting'
  | 'notifying'
  | 'done'
  | 'error'

export interface UploadResult {
  txid: string
  uhrpUrl: string
  recipientKey: string
  timestamp: number
  retentionExpiry: number
  providerCount: number
}

export interface FileMetadata {
  fileType: 'xray' | 'scan' | 'report' | 'other'
  bodyPart: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  retentionPeriod: number // minutes
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
    retentionPeriod: 10080, // 1 week default
  })
  const [step, setStep] = useState<UploadStep>('idle')
  const [failedStep, setFailedStep] = useState<UploadStep | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stepRef = useRef<UploadStep>('idle')

  const updateStep = (s: UploadStep) => {
    stepRef.current = s
    setStep(s)
  }

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

    updateStep('encrypting')
    setError(null)
    setResult(null)
    setFailedStep(null)

    try {
      // 1. Read file as bytes
      const fileBytes = new Uint8Array(await file.arrayBuffer())

      // 2. Generate unique keyID for encryption key derivation
      const keyID = crypto.randomUUID()

      // 3. Encrypt for recipient
      updateStep('encrypting')
      const ciphertext = await encryptForRecipient(fileBytes, recipientKey, keyID)

      // 4. Hash ciphertext for integrity verification (recipient hashes downloaded ciphertext)
      const contentHash = await hashContent(ciphertext)

      // 5. Upload encrypted file to UHRP
      updateStep('uploading')
      const storageResult = await uploadToUHRP(
        ciphertext,
        metadata.mimeType || 'application/octet-stream',
        metadata.retentionPeriod,
      )
      const uhrpUrl = storageResult.uhrpUrl

      // 5. Mint PushDrop token
      updateStep('minting')
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
          retentionExpiry: storageResult.retentionExpiry,
          providerCount: storageResult.providerCount,
        },
        keyID,
      }
      const mintResult = await mintUploadToken(tokenFields)
      let txid = mintResult.txid || ''
      if (!txid && mintResult.tx) {
        txid = Transaction.fromBEEF(mintResult.tx).id('hex')
      }

      // 6. Broadcast to overlay network + miners
      updateStep('broadcasting')
      await broadcastToken(tokenFields, mintResult, txid)

      // 7. Notify recipient via MessageBox
      updateStep('notifying')
      await notifyRecipient(recipientKey, {
        uhrpUrl,
        contentHash,
        tokenTxid: txid,
        senderKey,
        metadata: tokenFields.metadata,
      })

      updateStep('done')
      setResult({
        txid,
        uhrpUrl,
        recipientKey: recipientKey,
        timestamp: Date.now(),
        retentionExpiry: storageResult.retentionExpiry,
        providerCount: storageResult.providerCount,
      })
    } catch (err) {
      setFailedStep(stepRef.current)
      setStep('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const canSend = !!recipientKey && !!file && step === 'idle'

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Share Medical File</h2>

      <RecipientSearch onSelect={handleSelectRecipient} selectedKey={recipientKey} selectedName={recipientName} />

      <ImageUpload onFileSelect={handleFileSelect} file={file} metadata={metadata} />

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleSend}
          disabled={!canSend}
          className="gap-2"
        >
          <Lock className="w-4 h-4" />
          Share Securely
        </Button>
      </div>

      {step !== 'idle' && (
        <UploadProgress step={step} error={error} result={result} recipientName={recipientName} failedStep={failedStep} />
      )}
    </div>
  )
}
