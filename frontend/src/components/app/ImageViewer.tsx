import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Circle, Clock, Shield, Download, Info, Lock, Copy, Check } from 'lucide-react'
import { downloadFromUHRP } from '@/services/storage'
import { fetchProfile } from '@/services/identity'
import { decryptFromSender, hashContent } from '@/services/crypto'
import { recordView, queryFileViews, resolveNames, type MedicalToken, type ViewEvent } from '@/services/tokens'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatFileSize, formatTimestamp, truncateKey } from '@/lib/utils'
import { ease } from '@/lib/motion'

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative group/tip inline-flex">
      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-3 text-xs leading-relaxed rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-10">
        {children}
      </span>
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 dark:text-slate-500 text-slate-400" />}
    </button>
  )
}

interface ImageViewerProps {
  token: MedicalToken
  onBack: () => void
  backLabel?: string
}

type ViewStep = 'downloading' | 'verifying' | 'awaiting-decrypt' | 'decrypting' | 'done' | 'error'

export default function ImageViewer({ token, onBack, backLabel = 'Back to Inbox' }: ImageViewerProps) {
  const [step, setStep] = useState<ViewStep>('downloading')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAt, setErrorAt] = useState<ViewStep | null>(null)
  const [hashMatch, setHashMatch] = useState<boolean | null>(null)
  const [encryptedData, setEncryptedData] = useState<Uint8Array | null>(null)
  const [decryptedAt, setDecryptedAt] = useState<number | null>(null)
  const [senderName, setSenderName] = useState<string | null>(null)
  const [viewHistory, setViewHistory] = useState<ViewEvent[]>([])
  const [viewNames, setViewNames] = useState<Map<string, string>>(new Map())
  const [viewsLoading, setViewsLoading] = useState(true)

  const loadViewHistory = async () => {
    try {
      setViewsLoading(true)
      const views = await queryFileViews(token.txid)
      setViewHistory(views)
      const keys = views.map((v) => v.accessedBy).filter(Boolean)
      if (keys.length > 0) {
        const names = await resolveNames(keys)
        setViewNames(names)
      }
    } catch {
      // Non-critical — don't block the viewer
    } finally {
      setViewsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile(token.senderKey).then((p) => {
      if (p?.name) setSenderName(p.name)
    })
  }, [token.senderKey])

  useEffect(() => {
    loadViewHistory()
  }, [token.txid])

  useEffect(() => {
    let cancelled = false

    async function downloadAndVerify() {
      try {
        // 1. Download encrypted file from UHRP
        setStep('downloading')
        const encrypted = await downloadFromUHRP(token.uhrpUrl)
        if (cancelled) return

        // 2. Verify content hash
        setStep('verifying')
        const hash = await hashContent(encrypted)
        const match = hash === token.contentHash
        setHashMatch(match)
        if (!match) {
          setErrorAt('verifying')
          setStep('error')
          setError('Content hash mismatch — file may be tampered')
          return
        }
        if (cancelled) return

        // 3. Always wait for explicit user action before revealing content
        setEncryptedData(encrypted)
        setStep('awaiting-decrypt')
      } catch (err) {
        if (!cancelled) {
          setErrorAt('downloading')
          setStep('error')
          setError(err instanceof Error ? err.message : 'Failed to load image')
        }
      }
    }

    downloadAndVerify()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleDecrypt = async () => {
    if (!encryptedData) return
    try {
      setStep('decrypting')
      const plaintext = await decryptFromSender(
        encryptedData,
        token.senderKey,
        token.keyID,
      )
      const mimeType = token.metadata.mimeType || 'image/jpeg'
      const blob = new Blob([plaintext.buffer as ArrayBuffer], { type: mimeType })
      setImageUrl(URL.createObjectURL(blob))
      setDecryptedAt(Date.now())
      setStep('done')
      // Log view event (fire-and-forget)
      recordView(token.txid, token.vout, token.recipientKey)
        .then(() => loadViewHistory())
        .catch(() => {})
    } catch (err) {
      setErrorAt('decrypting')
      setStep('error')
      const raw = err instanceof Error ? err.message : ''
      // SDK decrypt errors dump JSON — provide a friendly message
      if (raw.toLowerCase().includes('decrypt')) {
        setError('Decryption failed — only the intended recipient can decrypt this file.')
      } else {
        setError(raw || 'Failed to decrypt file')
      }
    }
  }

  const stepStatus = (target: ViewStep) => {
    const order = ['downloading', 'verifying', 'decrypting', 'done']
    const ti = order.indexOf(target)

    if (step === 'error' && errorAt) {
      const ei = order.indexOf(errorAt)
      if (ti < ei) return 'done'
      if (ti === ei) return 'error'
      return 'waiting'
    }

    const current = step === 'awaiting-decrypt' ? 'decrypting' : step
    const ci = order.indexOf(current)
    if (ti < ci) return 'done'
    if (step === 'awaiting-decrypt' && target === 'decrypting') return 'pending'
    if (ti === ci) return 'active'
    return 'waiting'
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
    >
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Button>

      {/* Details & Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            File Details & Blockchain Proof
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {(step === 'done' || step === 'awaiting-decrypt') && (
            <>
              <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <span className="font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                  From
                  <Tip>
                    <strong className="block mb-1">Sender Identity</strong>
                    The sender's public identity key — a unique cryptographic fingerprint derived from their wallet. This proves who encrypted and shared the file with you.
                  </Tip>
                </span>
                <span className="flex items-center gap-2 min-w-0">
                  {senderName && <span className="text-sm font-semibold dark:text-slate-200 text-slate-700 shrink-0">{senderName}</span>}
                  <span className="font-mono text-xs dark:text-slate-500 text-slate-400 truncate">{token.senderKey}</span>
                  <CopyBtn text={token.senderKey} />
                </span>
                <span className="font-medium dark:text-slate-400 text-slate-500">File Type</span>
                <span className="dark:text-slate-300 text-slate-600">
                  {token.metadata.fileType}
                  {token.metadata.bodyPart && ` · ${token.metadata.bodyPart}`}
                </span>
                <span className="font-medium dark:text-slate-400 text-slate-500">Size</span>
                <span className="dark:text-slate-300 text-slate-600">{formatFileSize(token.metadata.fileSizeBytes)}</span>
                <span className="font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                  Hash
                  <Tip>
                    <strong className="block mb-1">Integrity Verification</strong>
                    The file's SHA-256 hash was recorded on-chain when the sender uploaded it. After downloading, the hash is recalculated and compared — if they match, the file has not been altered in transit.
                  </Tip>
                </span>
                <span className="dark:text-slate-300 text-slate-600 inline-flex items-center gap-1.5">
                  SHA-256 {hashMatch ? 'verified' : 'mismatch'}
                  {hashMatch ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                </span>
                <span className="font-medium dark:text-slate-400 text-slate-500">Sent</span>
                <span className="dark:text-slate-300 text-slate-600">{formatTimestamp(token.timestamp)}</span>
                {token.metadata.retentionExpiry && (
                  <>
                    <span className="font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                      Expires
                      <Tip>
                        <strong className="block mb-1">Storage Expiry</strong>
                        The date the sender's paid hosting period ends. After this, UHRP providers may remove the encrypted file. The sender can extend retention by re-uploading before expiry.
                      </Tip>
                    </span>
                    <span className="dark:text-slate-300 text-slate-600">
                      {new Date(token.metadata.retentionExpiry).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC',
                      })} UTC
                    </span>
                  </>
                )}
                {token.metadata.providerCount && (
                  <>
                    <span className="font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                      UHRP Hosts
                      <Tip>
                        <strong className="block mb-1">Storage Providers</strong>
                        The number of independent UHRP nodes hosting the encrypted file. More providers means better availability — if one goes offline, others still serve the data.
                      </Tip>
                    </span>
                    <span className="dark:text-slate-300 text-slate-600">
                      {token.metadata.providerCount} provider{token.metadata.providerCount !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
              <div className="border-t dark:border-slate-800/50 border-slate-200 pt-3">
                <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5">
                  <span className="font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                    Tx
                    <Tip>
                      <strong className="block mb-1">Blockchain Transaction</strong>
                      The on-chain transaction that records this file share. Click to view it on WhatsOnChain — it proves the upload happened at a specific time and cannot be altered retroactively.
                    </Tip>
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <a
                      href={`https://whatsonchain.com/tx/${token.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline break-all"
                    >
                      {token.txid}
                    </a>
                    <CopyBtn text={token.txid} />
                  </span>
                  <span className="font-medium dark:text-slate-400 text-slate-500 inline-flex items-center gap-1">
                    UHRP URL
                    <Tip>
                      <strong className="block mb-1">UHRP (Universal Hash Resolution Protocol)</strong>
                      A content-addressed URL derived from the file's SHA-256 hash. You can paste it into any UHRP resolver (e.g. https://uhrp-ui.bapp.dev/) to download the encrypted file independently and verify its integrity.
                    </Tip>
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs break-all dark:text-slate-300 text-slate-600">{token.uhrpUrl}</span>
                    <CopyBtn text={token.uhrpUrl} />
                  </span>
                  <span className="font-medium dark:text-slate-400 text-slate-500">Status</span>
                  <div className="flex items-center gap-2">
                    {step === 'done' ? (
                      <>
                        <Badge variant="success">DECRYPTED</Badge>
                        {decryptedAt && (
                          <span className="dark:text-slate-400 text-slate-500 text-xs">{formatTimestamp(decryptedAt)}</span>
                        )}
                      </>
                    ) : (
                      <Badge variant="warning">ENCRYPTED</Badge>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Progress steps */}
          <div className={`${step === 'done' ? 'border-t dark:border-slate-800/50 border-slate-200 pt-3' : ''} space-y-2`}>
            {[
              { id: 'downloading' as const, label: 'Downloading from UHRP' },
              { id: 'verifying' as const, label: 'Verifying content hash' },
              { id: 'decrypting' as const, label: 'Decrypting' },
            ].map(({ id, label }, i) => {
              const s = stepStatus(id)
              return (
                <motion.div
                  key={id}
                  className="flex items-center gap-3 text-sm"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4, ease }}
                >
                  <AnimatePresence mode="wait">
                    {s === 'done' && (
                      <motion.div
                        key="done"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      </motion.div>
                    )}
                    {s === 'active' && (
                      <motion.div key="active" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
                      </motion.div>
                    )}
                    {s === 'pending' && (
                      <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    )}
                    {s === 'waiting' && (
                      <Circle className="w-5 h-5 dark:text-slate-600 text-slate-300 flex-shrink-0" />
                    )}
                    {s === 'error' && (
                      <motion.div
                        key="error"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span className={
                    s === 'active'
                      ? 'dark:text-white text-slate-900'
                      : s === 'done'
                        ? 'dark:text-slate-300 text-slate-600'
                        : s === 'pending'
                          ? 'text-amber-500'
                          : 'dark:text-slate-600 text-slate-400'
                  }>
                    {label}
                    {s === 'done' && <span className="dark:text-slate-500 text-slate-400 ml-2">done</span>}
                    {s === 'done' && id === 'verifying' && hashMatch === false && (
                      <span className="text-rose-400 ml-1">mismatch</span>
                    )}
                    {s === 'pending' && <span className="text-amber-500/70 ml-2">awaiting action</span>}
                  </span>
                </motion.div>
              )
            })}
          </div>

          {/* Decrypt button — shown after download + verify complete */}
          {step === 'awaiting-decrypt' && (
            <div className="flex justify-center pt-2">
              <Button onClick={handleDecrypt} className="gap-2">
                <Lock className="w-4 h-4" />
                {token.status === 'decrypted' ? 'View File' : 'Decrypt File'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File display */}
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0, filter: 'blur(8px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease }}
        >
          <Card>
            <CardContent className="pt-6 space-y-4">
              {token.metadata.mimeType?.startsWith('image/') ? (
                <div className="flex justify-center">
                  <img
                    src={imageUrl}
                    alt={token.metadata.fileName || 'Decrypted file'}
                    className="max-w-full max-h-[500px] rounded-lg ring-1 ring-violet-500/20"
                  />
                </div>
              ) : token.metadata.mimeType === 'application/pdf' ? (
                <iframe
                  src={imageUrl}
                  title={token.metadata.fileName || 'Decrypted PDF'}
                  className="w-full h-[600px] rounded-lg ring-1 ring-violet-500/20"
                />
              ) : (
                <p className="text-center text-sm dark:text-slate-400 text-slate-500">
                  No inline preview available for this file type. Use the download button below.
                </p>
              )}
              <div className="flex justify-center">
                <a
                  href={imageUrl}
                  download={token.metadata.fileName || 'decrypted-file'}
                  className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 underline"
                >
                  <Download className="w-4 h-4" /> Download {token.metadata.fileName || 'file'}
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* View History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            View History
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {viewsLoading ? (
            <div className="flex items-center gap-2 dark:text-slate-400 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading view history…
            </div>
          ) : viewHistory.length === 0 ? (
            <p className="dark:text-slate-500 text-slate-400">No views recorded yet</p>
          ) : (
            <div className="space-y-2">
              {viewHistory.map((view, i) => (
                <div key={`${view.accessedBy}-${view.timestamp}-${i}`} className="flex items-center justify-between gap-4 py-1.5 border-b last:border-0 dark:border-slate-800/50 border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    {view.accessedBy ? (
                      <>
                        {viewNames.get(view.accessedBy) && (
                          <span className="text-sm font-medium dark:text-slate-200 text-slate-700 shrink-0">
                            {viewNames.get(view.accessedBy)}
                          </span>
                        )}
                        <span className="font-mono text-xs dark:text-slate-500 text-slate-400 truncate">
                          {truncateKey(view.accessedBy)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs italic dark:text-slate-500 text-slate-400">Unknown viewer</span>
                    )}
                  </div>
                  <span className="text-xs dark:text-slate-500 text-slate-400 shrink-0">
                    {view.timestamp ? formatTimestamp(view.timestamp) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="pt-6 text-sm text-rose-400">{error}</CardContent>
        </Card>
      )}
    </motion.div>
  )
}
