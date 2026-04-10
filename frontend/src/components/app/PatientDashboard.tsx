import { useState, useCallback, useRef, useEffect } from 'react'
import { useWallet } from '@/context/WalletContext'
import RecipientSearch from './RecipientSearch'
import ImageUpload from './ImageUpload'
import UploadProgress from './UploadProgress'
import { encryptForRecipient, hashContent } from '@/services/crypto'
import { uploadToUHRP, resolveCdnUrl, publishUhrpAdvertisement } from '@/services/storage'
import { mintUploadToken, broadcastToken, querySentTokens, updateTokenCdnUrl, type MedicalTokenFields } from '@/services/tokens'
import { Transaction } from '@bsv/sdk'
import { notifyRecipient } from '@/services/messagebox'
import { getIdentityKey } from '@/services/wallet'
import { Button } from '@/components/ui/button'
import { Lock, ShieldCheck, Database, Eye } from 'lucide-react'

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
  providerNames: string[]
}

export interface FileMetadata {
  fileType: 'xray' | 'scan' | 'report' | 'other'
  bodyPart: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  retentionPeriod: number // minutes
  selectedProviders?: string[]
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

  // Backfill CDN URLs for sender's existing tokens that are missing them
  useEffect(() => {
    if (!identityKey) return
    let cancelled = false

    void (async () => {
      try {
        const tokens = await querySentTokens(identityKey)
        const missing = tokens.filter((t) => t.uhrpUrl && !t.metadata?.cdnUrl)
        if (missing.length === 0) return
        console.log(`[CDN backfill] ${missing.length} token(s) missing cdnUrl`)

        for (const token of missing) {
          if (cancelled) break
          try {
            console.log(`[CDN backfill] Resolving CDN URL for txid ${token.txid}...`)
            const cdnUrl = await resolveCdnUrl(token.uhrpUrl)
            if (cdnUrl && !cancelled) {
              await updateTokenCdnUrl(token.txid, identityKey, cdnUrl)
              console.log(`[CDN backfill] Updated CDN URL for txid ${token.txid}`)
              // Also publish UHRP advertisement so file is publicly resolvable
              void publishUhrpAdvertisement(
                token.uhrpUrl, cdnUrl, token.metadata?.fileSizeBytes || 0,
                token.metadata?.retentionExpiry || (Date.now() + 365 * 24 * 60 * 60 * 1000),
              ).then(() => console.log(`[CDN backfill] UHRP ad published for txid ${token.txid}`))
                .catch((e) => console.warn(`[CDN backfill] UHRP ad failed for txid ${token.txid}:`, e))
            }
          } catch (err) {
            console.warn(`[CDN backfill] Failed for txid ${token.txid}:`, err)
          }
        }
      } catch (err) {
        console.warn('[CDN backfill] Failed to query sent tokens:', err)
      }
    })()

    return () => { cancelled = true }
  }, [identityKey])

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
        metadata.selectedProviders,
      )
      const uhrpUrl = storageResult.uhrpUrl

      // 5a. Publish UHRP advertisement to public overlay (fire-and-forget)
      if (storageResult.cdnUrl) {
        void publishUhrpAdvertisement(
          uhrpUrl,
          storageResult.cdnUrl,
          ciphertext.byteLength,
          storageResult.retentionExpiry,
        ).catch((err) => console.warn('[UHRP ad] Failed to publish:', err))
      }

      // 5b. Mint PushDrop token
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
          providerUrls: storageResult.providerUrls,
          cdnUrl: storageResult.cdnUrl,
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
        providerNames: storageResult.providerUrls,
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

      {canSend && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 dark:bg-violet-500/10 px-4 py-3.5 space-y-2.5 transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 dark:hover:bg-violet-500/15 hover:shadow-md hover:shadow-violet-500/10">
          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
            <span>Encrypted exclusively for the selected recipient</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Database className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
            <span>Stored on tamper-proof blockchain storage (UHRP)</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Eye className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
            <span>Only the recipient can decrypt and view the file</span>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleSend}
          disabled={!canSend}
          className="gap-2 px-12"
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
