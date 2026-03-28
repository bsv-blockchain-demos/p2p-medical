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
import { Lock, CheckCircle2, Info, Clock, Server } from 'lucide-react'

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
    retentionPeriod: 525600, // 1 year default
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
      const storageResult = await uploadToUHRP(
        ciphertext,
        metadata.mimeType || 'application/octet-stream',
        metadata.retentionPeriod,
      )
      const uhrpUrl = storageResult.uhrpUrl

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
          retentionExpiry: storageResult.retentionExpiry,
          providerCount: storageResult.providerCount,
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
        retentionExpiry: storageResult.retentionExpiry,
        providerCount: storageResult.providerCount,
      })
    } catch (err) {
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
        <UploadProgress step={step} error={error} />
      )}

      {result && (
        <Card className="border-emerald-500/20 dark:bg-emerald-950/10 bg-emerald-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-emerald-600 dark:text-emerald-400 text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Success
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 items-baseline">
              <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Txid</span>
              <a
                href={`https://whatsonchain.com/tx/${result.txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs break-all text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline"
              >
                {result.txid}
              </a>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 items-baseline">
              <span className="text-xs font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                UHRP
                <span className="relative group/tip">
                  <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 text-xs leading-relaxed rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-10">
                    <strong className="block mb-1">UHRP (Universal Hash Resolution Protocol)</strong>
                    This URL is derived from the file's SHA-256 hash — if the file changes, the URL breaks. You can paste it into any UHRP resolver (e.g. <span className="font-mono">https://uhrp-ui.bapp.dev/</span>) to download the encrypted file and independently verify its integrity.
                  </span>
                </span>
              </span>
              <span className="font-mono text-xs break-all dark:text-slate-500 text-slate-400">{result.uhrpUrl}</span>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 items-baseline">
              <span className="text-xs font-medium dark:text-slate-400 text-slate-500">To</span>
              <span className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold dark:text-slate-200 text-slate-700 shrink-0">{recipientName || 'Unknown'}</span>
                <span className="font-mono text-xs dark:text-slate-500 text-slate-400 truncate">{result.recipientKey}</span>
              </span>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 items-baseline">
              <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Time</span>
              <span className="text-sm dark:text-slate-200 text-slate-700">{formatTimestamp(result.timestamp)}</span>
            </div>
            <div className="border-t dark:border-slate-800/50 border-slate-200 pt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500 shrink-0" />
                <span className="dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                  Expires
                  <span className="relative group/ret">
                    <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                    <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-3 text-xs leading-relaxed rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/ret:opacity-100 group-hover/ret:pointer-events-auto transition-opacity z-10">
                      <strong className="block mb-1">Retention Expiry</strong>
                      The date your file's paid hosting period ends. After this, storage providers may remove it. You can extend retention by re-uploading before expiry.
                    </span>
                  </span>
                </span>
                <span className="dark:text-slate-300 text-slate-600">
                  {new Date(result.retentionExpiry).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500 shrink-0" />
                <span className="dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                  <span className="dark:text-slate-300 text-slate-600">
                    Stored on {result.providerCount} provider{result.providerCount !== 1 ? 's' : ''}
                  </span>
                  <span className="relative group/prov">
                    <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                    <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-64 p-3 text-xs leading-relaxed rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/prov:opacity-100 group-hover/prov:pointer-events-auto transition-opacity z-10">
                      <strong className="block mb-1">Storage Providers</strong>
                      The number of independent UHRP nodes hosting your encrypted file. More providers means better redundancy — if one goes offline, others still serve the data.
                    </span>
                  </span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
