import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Circle, Clock, Shield, Download, Info, Lock, Copy, Check, Eye, ExternalLink } from 'lucide-react'
import { downloadFromUHRP } from '@/services/storage'
import { fetchProfile } from '@/services/identity'
import { decryptFromSender, hashContent } from '@/services/crypto'
import { recordView, queryFileViews, resolveNames, type MedicalToken, type ViewEvent } from '@/services/tokens'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatFileSize, formatTimestamp, truncateKey } from '@/lib/utils'
import { ease } from '@/lib/motion'

const FILE_TYPE_LABELS: Record<string, string> = {
  xray: 'X-Ray',
  scan: 'Scan',
  report: 'Report',
  other: 'Other',
}

function Tip({ title, points }: { title: string; points: string[] }) {
  return (
    <span className="relative group/tip inline-flex">
      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-10">
        <strong className="block text-xs mb-1.5">{title}</strong>
        <ul className="space-y-1">
          {points.map((pt, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300">
              <span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>
              {pt}
            </li>
          ))}
        </ul>
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
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [viewHistory, setViewHistory] = useState<ViewEvent[]>([])
  const [viewNames, setViewNames] = useState<Map<string, string>>(new Map())
  const [viewsLoading, setViewsLoading] = useState(true)

  const fileTypeLabel = FILE_TYPE_LABELS[token.metadata.fileType] || token.metadata.fileType

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
      // Non-critical:don't block the viewer
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
    fetchProfile(token.recipientKey).then((p) => {
      if (p?.name) setRecipientName(p.name)
    })
  }, [token.recipientKey])

  useEffect(() => {
    loadViewHistory()
  }, [token.txid])

  useEffect(() => {
    let cancelled = false

    async function downloadAndVerify() {
      try {
        // 1. Download encrypted file from UHRP
        setStep('downloading')
        const encrypted = await downloadFromUHRP(token.uhrpUrl, token.metadata.cdnUrl)
        if (cancelled) return

        // 2. Verify content hash
        setStep('verifying')
        const hash = await hashContent(encrypted)
        const match = hash === token.contentHash
        setHashMatch(match)
        if (!match) {
          setErrorAt('verifying')
          setStep('error')
          setError('Content hash mismatch:file may be tampered')
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
      // SDK decrypt errors dump JSON:provide a friendly message
      if (raw.toLowerCase().includes('decrypt')) {
        setError('Decryption failed:only the intended recipient can decrypt this file.')
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

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">File Details</h2>
          <p className="text-sm text-muted-foreground">Encrypted file shared to your wallet</p>
        </div>
      </div>

      {/* Main card — single vertical list */}
      <Card>
        <CardContent className="pt-6 text-sm space-y-4">
          {/* Top bar: status badge */}
          <div>
            <Badge variant={step === 'done' ? 'success' : 'secondary'}>
              {step === 'done' ? 'DECRYPTED' : 'ENCRYPTED'}
            </Badge>
          </div>

          <div className="border-t dark:border-slate-800/50 border-slate-200" />

          {/* File info rows */}
          <div className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2.5 text-xs">
            <span className="dark:text-slate-500 text-slate-400">From</span>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="dark:text-slate-200 text-slate-700 font-medium truncate">
                {senderName || truncateKey(token.senderKey, 8)}
              </span>
              <span className="font-mono text-muted-foreground">{truncateKey(token.senderKey, 6)}</span>
              <CopyBtn text={token.senderKey} />
            </span>

            <span className="dark:text-slate-500 text-slate-400">To</span>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="dark:text-slate-200 text-slate-700 font-medium truncate">
                {recipientName || truncateKey(token.recipientKey, 8)}
              </span>
              <span className="font-mono text-muted-foreground">{truncateKey(token.recipientKey, 6)}</span>
              <CopyBtn text={token.recipientKey} />
            </span>

            <span className="dark:text-slate-500 text-slate-400">Type</span>
            <span className="dark:text-slate-300 text-slate-600">{fileTypeLabel}</span>

            <span className="dark:text-slate-500 text-slate-400">Size</span>
            <span className="dark:text-slate-300 text-slate-600">{formatFileSize(token.metadata.fileSizeBytes)}</span>

            <span className="dark:text-slate-500 text-slate-400">Sent</span>
            <span className="dark:text-slate-300 text-slate-600">{formatTimestamp(token.timestamp)}</span>

            {token.metadata.retentionExpiry && (
              <>
                <span className="dark:text-slate-500 text-slate-400">Expires</span>
                <span className="dark:text-slate-300 text-slate-600">
                  {new Date(token.metadata.retentionExpiry).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                </span>
              </>
            )}
          </div>

          {/* Blockchain proof rows (gated) */}
          {(step === 'done' || step === 'awaiting-decrypt') && (
            <>
              <div className="border-t dark:border-slate-800/50 border-slate-200" />

              <div className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2.5 text-xs">
                {/* Txid */}
                <span className="dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                  Txid
                  <Tip
                    title="Blockchain Transaction"
                    points={[
                      'On-chain record of this file share',
                      'Click to view on WhatsOnChain',
                      'Proves upload happened at a specific time',
                      'Cannot be altered retroactively',
                    ]}
                  />
                </span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <a
                    href={`https://whatsonchain.com/tx/${token.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline break-all inline-flex items-center gap-1"
                  >
                    {token.txid}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <CopyBtn text={token.txid} />
                </span>

                {/* UHRP */}
                <span className="dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                  UHRP
                  <Tip
                    title="UHRP (Universal Hash Resolution Protocol)"
                    points={[
                      'Content-addressed URL from file\'s SHA-256 hash',
                      'Paste into any UHRP resolver to download independently',
                      'Verify file integrity against the on-chain hash',
                    ]}
                  />
                </span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono break-all dark:text-slate-300 text-slate-600">{token.uhrpUrl}</span>
                  <CopyBtn text={token.uhrpUrl} />
                </span>

                {/* Hash */}
                <span className="dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                  Hash
                  <Tip
                    title="Integrity Verification"
                    points={[
                      'SHA-256 hash recorded on-chain at upload',
                      'Hash recalculated after download',
                      'Match confirms file was not altered in transit',
                    ]}
                  />
                </span>
                <span>
                  {hashMatch ? (
                    <span className="inline-flex items-center gap-1.5 dark:text-slate-300 text-slate-600">
                      SHA-256 verified
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 dark:text-slate-300 text-slate-600">
                      SHA-256 mismatch
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    </span>
                  )}
                </span>

                {/* Stored (provider info) */}
                {token.metadata.providerCount && (
                  <>
                    <span className="dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                      Stored
                      <Tip
                        title="Storage Providers"
                        points={[
                          'Number of independent UHRP nodes hosting the file',
                          'More providers = better availability',
                          'If one goes offline, others still serve the data',
                        ]}
                      />
                    </span>
                    <span className="dark:text-slate-300 text-slate-600 inline-flex items-center gap-2 flex-wrap">
                      {token.metadata.providerCount} provider{token.metadata.providerCount !== 1 ? 's' : ''}
                      {(() => {
                        const urls = token.metadata.providerUrls
                        if (urls && urls.length > 0) {
                          return urls.map((u: string, i: number) => (
                            <span key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500">{u}</span>
                          ))
                        }
                        if (token.metadata.cdnUrl) {
                          const origin = new URL(token.metadata.cdnUrl).origin
                          return <span className="text-[11px] font-mono px-1.5 py-0.5 rounded dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500">{origin}</span>
                        }
                        return null
                      })()}
                    </span>
                  </>
                )}
              </div>
            </>
          )}

          {/* Download & Decrypt */}
          <div className="border-t dark:border-slate-800/50 border-slate-200" />

          {/* Progress steps */}
          <div className="space-y-2">
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

          {/* Decrypt button:shown after download + verify complete */}
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
        <CardContent className="pt-6 text-sm">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            View History
          </span>

          <div className="mt-3">
            {viewsLoading ? (
              <div className="flex items-center gap-2 dark:text-slate-400 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading view history…
              </div>
            ) : viewHistory.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-3">
                  <Eye className="w-5 h-5 text-violet-400" />
                </div>
                <p className="text-sm text-muted-foreground">No views recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {viewHistory.map((view, i) => {
                  const viewerName = view.accessedBy ? viewNames.get(view.accessedBy) : null
                  const viewerInitial = viewerName ? viewerName[0].toUpperCase() : '?'

                  return (
                    <div key={`${view.accessedBy}-${view.timestamp}-${i}`} className="flex items-center justify-between gap-4 py-1.5 border-b last:border-0 dark:border-slate-800/50 border-slate-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {viewerInitial}
                        </div>
                        {view.accessedBy ? (
                          <div className="min-w-0">
                            {viewerName && (
                              <div className="text-sm font-medium dark:text-slate-200 text-slate-700 truncate">
                                {viewerName}
                              </div>
                            )}
                            <div className="font-mono text-xs dark:text-slate-500 text-slate-400 truncate">
                              {truncateKey(view.accessedBy)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs italic dark:text-slate-500 text-slate-400">Unknown viewer</span>
                        )}
                      </div>
                      <span className="text-xs dark:text-slate-500 text-slate-400 shrink-0">
                        {view.timestamp ? formatTimestamp(view.timestamp) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
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
