import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@/context/WalletContext'
import RecipientSearch from './RecipientSearch'
import ImageUpload, { RETENTION_OPTIONS } from './ImageUpload'
import UploadProgress from './UploadProgress'
import { encryptForRecipient, hashContent } from '@/services/crypto'
import { uploadToUHRP, resolveCdnUrl, publishUhrpAdvertisement } from '@/services/storage'
import { mintUploadToken, broadcastToken, querySentTokens, updateTokenCdnUrl, type MedicalTokenFields } from '@/services/tokens'
import { Transaction } from '@bsv/sdk'
import { notifyRecipient } from '@/services/messagebox'
import { getIdentityKey } from '@/services/wallet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, Shield, Eye, ShieldCheck, Check, FileImage, FileText, File as FileIcon, HardDrive, Clock } from 'lucide-react'
import { cn, truncateKey, formatFileSize } from '@/lib/utils'
import { summaryStagger, summaryRow } from '@/lib/motion'

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

const FILE_TYPE_LABELS: Record<FileMetadata['fileType'], string> = {
  xray: 'X-Ray',
  scan: 'Scan',
  report: 'Report',
  other: 'Other',
}

const STEPS = [
  { num: 1, label: 'Recipient' },
  { num: 2, label: 'File' },
  { num: 3, label: 'Review & Send' },
] as const

function getFileIconComponent(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType === 'application/pdf' || mimeType === 'text/plain') return FileText
  return FileIcon
}

export default function PatientDashboard() {
  const { identityKey, profile } = useWallet()
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
  const isUploading = step !== 'idle'

  // Step indicator state — all steps done once upload starts
  const activeStep = isUploading ? 4 : !recipientKey ? 1 : !file ? 2 : 3
  const retentionLabel = RETENTION_OPTIONS.find((o) => o.minutes === metadata.retentionPeriod)?.label || '1 Week'
  const FileIconComp = metadata.mimeType ? getFileIconComponent(metadata.mimeType) : FileImage

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Share Medical File</h2>
            <p className="text-sm text-muted-foreground">Encrypt and deliver directly to your doctor's wallet</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-violet-500" /> End-to-end encrypted</span>
          <span className="text-slate-300 dark:text-slate-600">&middot;</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-violet-500" /> Blockchain-verified</span>
          <span className="text-slate-300 dark:text-slate-600">&middot;</span>
          <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-violet-500" /> Only the recipient can decrypt</span>
        </div>
      </div>

      {/* Step indicator bar */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const isDone = activeStep > s.num
          const isActive = activeStep === s.num
          return (
            <div key={s.num} className="flex items-center">
              {i > 0 && (
                <div className="w-8 h-0.5 mx-1">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isDone || isActive
                        ? 'bg-gradient-to-r from-violet-500 to-indigo-500'
                        : 'bg-slate-200 dark:bg-slate-700',
                    )}
                  />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 shrink-0',
                    isDone && 'bg-violet-500 text-white',
                    isActive && 'border-2 border-violet-500 text-violet-500 animate-breathing',
                    !isDone && !isActive && 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500',
                  )}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium transition-colors',
                    isDone || isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Step 1: Recipient */}
      <RecipientSearch onSelect={handleSelectRecipient} selectedKey={recipientKey} selectedName={recipientName} />

      {/* Step 2: File — dimmed when no recipient */}
      <div className={cn(
        'transition-all duration-300 relative z-10',
        !recipientKey && 'opacity-40 pointer-events-none',
      )}>
        <ImageUpload onFileSelect={handleFileSelect} file={file} metadata={metadata} />
      </div>

      {/* Step 3: Pre-send summary + CTA */}
      <AnimatePresence>
        {canSend && !isUploading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Summary card */}
            <Card className="border-violet-500/20 dark:bg-violet-950/10 bg-violet-50/30">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <h3 className="font-semibold">Review Before Sending</h3>
                </div>
                <motion.div
                  variants={summaryStagger}
                  initial="hidden"
                  animate="show"
                  className="space-y-2.5"
                >
                  {/* From */}
                  <motion.div variants={summaryRow} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground w-16 shrink-0">From</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(profile?.name || 'Y')[0].toUpperCase()}
                      </div>
                      <span className="font-medium truncate">{profile?.name || truncateKey(identityKey!, 8)}</span>
                      {profile?.role && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{profile.role === 'doctor' ? 'Doctor' : 'Patient'}</Badge>
                      )}
                    </div>
                  </motion.div>

                  {/* To */}
                  <motion.div variants={summaryRow} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground w-16 shrink-0">To</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(recipientName || 'R')[0].toUpperCase()}
                      </div>
                      <span className="font-medium truncate">{recipientName || truncateKey(recipientKey!, 8)}</span>
                      {recipientName && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Doctor</Badge>
                      )}
                    </div>
                  </motion.div>

                  {/* File */}
                  <motion.div variants={summaryRow} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground w-16 shrink-0">File</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIconComp className="w-4 h-4 text-violet-500 shrink-0" />
                      <span className="truncate">{metadata.fileName}</span>
                      <span className="text-muted-foreground text-xs shrink-0">{formatFileSize(metadata.fileSizeBytes)}</span>
                    </div>
                  </motion.div>

                  {/* Settings row */}
                  <motion.div variants={summaryRow} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground w-16 shrink-0">Details</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                        <FileIconComp className="w-3 h-3" />
                        {FILE_TYPE_LABELS[metadata.fileType]}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                        <Clock className="w-3 h-3" />
                        {retentionLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                        <HardDrive className="w-3 h-3" />
                        {metadata.selectedProviders?.length === 2 ? 'All Providers' : '1 Provider'}
                      </span>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Footer trust signal */}
                <div className="border-t dark:border-slate-800/40 border-slate-200/40 pt-3 mt-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    File will be encrypted, stored on UHRP, and recorded on-chain
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  size="lg"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="gap-2 px-12 h-12 text-base shadow-violet-lg"
                >
                  <Lock className="w-4 h-4" />
                  Encrypt & Share
                </Button>
              </motion.div>
              <p className="text-xs text-muted-foreground">Your file will be encrypted before leaving this device</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step !== 'idle' && (
        <UploadProgress step={step} error={error} result={result} recipientName={recipientName} failedStep={failedStep} metadata={metadata} senderName={profile?.name || null} senderKey={identityKey} />
      )}
    </div>
  )
}
