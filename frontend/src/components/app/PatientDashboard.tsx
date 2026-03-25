import { useState, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import DoctorSearch from './DoctorSearch'
import ImageUpload from './ImageUpload'
import UploadProgress from './UploadProgress'
import { encryptForRecipient, hashContent } from '@/services/crypto'
import { uploadToUHRP } from '@/services/storage'
import { mintUploadToken, type MedicalTokenFields } from '@/services/tokens'
import { notifyDoctor } from '@/services/messagebox'
import { getIdentityKey } from '@/services/wallet'
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
  const [doctorKey, setDoctorKey] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState<string | null>(null)
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

  const handleSelectDoctor = useCallback((key: string, name?: string) => {
    setDoctorKey(key)
    setDoctorName(name || null)
  }, [])

  const handleFileSelect = useCallback((f: File, meta: FileMetadata) => {
    setFile(f)
    setMetadata(meta)
  }, [])

  const handleSend = async () => {
    if (!file || !doctorKey || !identityKey) return

    setStep('encrypting')
    setError(null)
    setResult(null)

    try {
      // 1. Read file as bytes
      const fileBytes = new Uint8Array(await file.arrayBuffer())

      // 2. Hash plaintext for integrity
      const contentHash = await hashContent(fileBytes)
      const keyID = contentHash // Use content hash as unique key ID

      // 3. Encrypt for doctor
      setStep('encrypting')
      const ciphertext = await encryptForRecipient(fileBytes, doctorKey, keyID)

      // 4. Upload encrypted file to UHRP
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
        recipientKey: doctorKey,
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

      // 6. Notify doctor via MessageBox
      setStep('notifying')
      const txid = mintResult.txid || ''
      await notifyDoctor(doctorKey, {
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
        recipientKey: doctorKey,
        timestamp: Date.now(),
      })
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const canSend = !!doctorKey && !!file && step === 'idle'

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">SHARE MEDICAL IMAGE</h2>

      <DoctorSearch onSelect={handleSelectDoctor} selectedKey={doctorKey} selectedName={doctorName} />

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
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 text-lg">Success</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Txid:</span>{' '}
              <span className="font-mono">{result.txid}</span>
            </div>
            <div>
              <span className="font-medium">UHRP:</span>{' '}
              <span className="font-mono text-xs">{result.uhrpUrl}</span>
            </div>
            <div>
              <span className="font-medium">To:</span>{' '}
              <span className="font-mono">{doctorName || result.recipientKey}</span>
            </div>
            <div>
              <span className="font-medium">Time:</span>{' '}
              {new Date(result.timestamp).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
