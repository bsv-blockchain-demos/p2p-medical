import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { CheckCircle2, Circle, Loader2, XCircle, Info, Copy, Check, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatFileSize, formatTimestamp, truncateKey } from '@/lib/utils'
import { ease, successDetailRow, successStagger } from '@/lib/motion'
import type { UploadStep, UploadResult, FileMetadata } from './PatientDashboard'

const FILE_TYPE_LABELS: Record<string, string> = {
  xray: 'X-Ray',
  scan: 'Scan',
  report: 'Report',
  other: 'Other',
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

function Tip({ title, points }: { title: string; points: string[] }) {
  return (
    <span className="relative group/tip inline-flex">
      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
      <span className="absolute right-0 top-full mt-1 sm:right-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-full sm:mt-0 sm:ml-2 w-64 sm:w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-10">
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

interface UploadProgressProps {
  step: UploadStep
  error: string | null
  result: UploadResult | null
  recipientName: string | null
  failedStep: UploadStep | null
  metadata: FileMetadata | null
  senderName: string | null
  senderKey: string | null
}

interface StepDef {
  id: UploadStep
  label: string
  tooltip?: { title: string; points: string[] }
}

const steps: StepDef[] = [
  {
    id: 'encrypting',
    label: 'Encrypting file',
    tooltip: {
      title: 'End-to-End Encryption',
      points: [
        'Derives a shared secret from your key + recipient\'s key (ECDH)',
        'Encrypts with AES-256-GCM',
        'Only the recipient\'s wallet can decrypt',
        'Storage providers cannot read the contents',
      ],
    },
  },
  {
    id: 'uploading',
    label: 'Uploading to UHRP',
    tooltip: {
      title: 'Content-Addressable Storage',
      points: [
        'Uploads to one or more UHRP storage providers',
        'URL is derived from the file\'s SHA-256 hash',
        'If a single byte changes, the URL breaks',
        'Guarantees file integrity',
      ],
    },
  },
  {
    id: 'minting',
    label: 'Minting Blockchain Token',
    tooltip: {
      title: 'On-Chain Record',
      points: [
        'Creates a PushDrop token with file metadata',
        'Locks UHRP URL, content hash, sender & recipient',
        'Stored in a Bitcoin transaction output',
        'Immutable and tamper-proof',
      ],
    },
  },
  {
    id: 'broadcasting',
    label: 'Broadcasting to Overlay Network',
    tooltip: {
      title: 'Network Indexing',
      points: [
        'Submits to topic manager (tm_medical_token)',
        'Indexes the token for discovery',
        'Queryable via lookup service (ls_medical_token)',
      ],
    },
  },
  {
    id: 'notifying',
    label: 'Notifying recipient via MessageBox',
    tooltip: {
      title: 'Recipient Notification',
      points: [
        'Sends to recipient\'s MessageBox inbox',
        'Includes UHRP URL, content hash & file metadata',
        'Recipient\'s wallet can locate and decrypt the file',
      ],
    },
  },
]

const stepOrder = ['encrypting', 'uploading', 'minting', 'broadcasting', 'notifying', 'done']

function getStepStatus(
  currentStep: UploadStep,
  targetStep: UploadStep,
  failedStep: UploadStep | null,
): 'done' | 'active' | 'waiting' | 'error' {
  if (currentStep === 'error' && failedStep) {
    const targetIdx = stepOrder.indexOf(targetStep)
    const failedIdx = stepOrder.indexOf(failedStep)
    if (targetIdx < failedIdx) return 'done'
    if (targetIdx === failedIdx) return 'error'
    return 'waiting'
  }
  if (currentStep === 'done') return 'done'

  const currentIdx = stepOrder.indexOf(currentStep)
  const targetIdx = stepOrder.indexOf(targetStep)

  if (targetIdx < currentIdx) return 'done'
  if (targetIdx === currentIdx) return 'active'
  return 'waiting'
}

const iconSpring = {
  initial: { scale: 0, rotate: -90 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 300, damping: 15 },
  },
}

export default function UploadProgress({ step, error, result, recipientName, failedStep, metadata, senderName, senderKey }: UploadProgressProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const hasFiredRef = useRef(false)

  // Fire confetti on success
  useEffect(() => {
    if (step !== 'done' || hasFiredRef.current) return
    hasFiredRef.current = true
    const timer = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (rect.left + rect.width / 2) / window.innerWidth
      const y = (rect.top + 20) / window.innerHeight
      const defaults = {
        origin: { x, y },
        particleCount: 40,
        spread: 55,
        startVelocity: 30,
        gravity: 1.2,
        ticks: 60,
        colors: ['#a78bfa', '#818cf8', '#34d399', '#6ee7b7', '#c4b5fd'],
        disableForReducedMotion: true,
      }
      confetti({ ...defaults, angle: 60 })
      confetti({ ...defaults, angle: 120 })
    }, 350)
    return () => clearTimeout(timer)
  }, [step])

  // Reset confetti flag when returning to idle
  useEffect(() => {
    if (step === 'idle') hasFiredRef.current = false
  }, [step])

  return (
    <Card
      ref={cardRef}
      className={cn(
        'transition-all duration-500',
        step === 'done' && 'border-emerald-500/20 dark:bg-emerald-950/5 bg-emerald-50/30',
        step === 'error' && 'border-rose-500/20',
      )}
    >
      <CardContent className="pt-6">
        <motion.h3
          className={cn(
            'font-semibold mb-4 text-xs tracking-widest uppercase',
            step === 'done' && 'text-emerald-600 dark:text-emerald-400 shimmer',
            step === 'error' && 'text-rose-500 dark:text-rose-400',
            step !== 'done' && step !== 'error' && 'text-violet-500 dark:text-violet-400',
          )}
          animate={step === 'done' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.4, ease }}
        >
          {step === 'done' ? 'COMPLETE' : step === 'error' ? 'ERROR' : 'PROGRESS'}
        </motion.h3>

        <div className="space-y-3">
          {steps.map(({ id, label, tooltip }, i) => {
            const status = getStepStatus(step, id, failedStep)
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4, ease }}
              >
                <div className="flex items-center gap-3 text-sm">
                  <AnimatePresence mode="wait">
                    {status === 'done' && (
                      <motion.div key="done" {...iconSpring}>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      </motion.div>
                    )}
                    {status === 'active' && (
                      <motion.div key="active" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
                      </motion.div>
                    )}
                    {status === 'waiting' && (
                      <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                    )}
                    {status === 'error' && (
                      <motion.div key="error" {...iconSpring}>
                        <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      status === 'active'
                        ? 'dark:text-white text-slate-900'
                        : status === 'done'
                          ? 'dark:text-slate-300 text-slate-600'
                          : status === 'waiting'
                            ? 'text-slate-600'
                            : 'text-rose-400',
                    )}
                  >
                    {label}
                    {tooltip && (
                      <span className="relative group/step inline-flex">
                        <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                        <span className="absolute right-0 top-full mt-1 sm:right-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-full sm:mt-0 sm:ml-2 w-64 sm:w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/step:opacity-100 group-hover/step:pointer-events-auto transition-opacity z-10">
                          <strong className="block text-xs mb-1.5">{tooltip.title}</strong>
                          <ul className="space-y-1">
                            {tooltip.points.map((pt, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300">
                                <span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </span>
                      </span>
                    )}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="ml-8 mt-1.5 h-1 rounded-full bg-slate-800/30 dark:bg-slate-700/30 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      status === 'error'
                        ? 'bg-rose-400'
                        : status === 'done'
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-violet-500 to-indigo-400'
                    }`}
                    initial={{ width: '0%' }}
                    animate={{
                      width:
                        status === 'done' || status === 'error'
                          ? '100%'
                          : status === 'active'
                            ? '60%'
                            : '0%',
                    }}
                    transition={{
                      duration: status === 'active' ? 2 : 0.5,
                      ease: status === 'active' ? 'linear' : ease,
                    }}
                    style={
                      status === 'active'
                        ? { boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)' }
                        : undefined
                    }
                  />
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Success details */}
        <AnimatePresence>
          {step === 'done' && result && (
            <motion.div
              key="success-details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.5, ease }}
                className="my-5 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"
              />
              <motion.div
                variants={successStagger}
                initial="hidden"
                animate="show"
                className="text-sm space-y-4"
              >
                {/* Status badge */}
                <motion.div variants={successDetailRow}>
                  <Badge variant="secondary">ENCRYPTED</Badge>
                </motion.div>

                <div className="border-t dark:border-slate-800/50 border-slate-200" />

                {/* File info rows — matches ImageViewer layout */}
                <div className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2.5 text-xs">
                  {/* From */}
                  {senderKey && (
                    <>
                      <span className="dark:text-slate-500 text-slate-400">From</span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="dark:text-slate-200 text-slate-700 font-medium truncate">
                          {senderName || truncateKey(senderKey, 8)}
                        </span>
                        <span className="font-mono text-muted-foreground">{truncateKey(senderKey, 6)}</span>
                        <CopyBtn text={senderKey} />
                      </span>
                    </>
                  )}

                  {/* To */}
                  <span className="dark:text-slate-500 text-slate-400">To</span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="dark:text-slate-200 text-slate-700 font-medium truncate">
                      {recipientName || truncateKey(result.recipientKey, 8)}
                    </span>
                    <span className="font-mono text-muted-foreground">{truncateKey(result.recipientKey, 6)}</span>
                    <CopyBtn text={result.recipientKey} />
                  </span>

                  {/* Type */}
                  {metadata?.fileType && (
                    <>
                      <span className="dark:text-slate-500 text-slate-400">Type</span>
                      <span className="dark:text-slate-300 text-slate-600">{FILE_TYPE_LABELS[metadata.fileType] || metadata.fileType}</span>
                    </>
                  )}

                  {/* Size */}
                  {metadata?.fileSizeBytes != null && metadata.fileSizeBytes > 0 && (
                    <>
                      <span className="dark:text-slate-500 text-slate-400">Size</span>
                      <span className="dark:text-slate-300 text-slate-600">{formatFileSize(metadata.fileSizeBytes)}</span>
                    </>
                  )}

                  {/* Sent */}
                  <span className="dark:text-slate-500 text-slate-400">Sent</span>
                  <span className="dark:text-slate-300 text-slate-600">{formatTimestamp(result.timestamp)}</span>

                  {/* Expires */}
                  {result.retentionExpiry && (
                    <>
                      <span className="dark:text-slate-500 text-slate-400">Expires</span>
                      <span className="dark:text-slate-300 text-slate-600">{formatTimestamp(result.retentionExpiry)}</span>
                    </>
                  )}
                </div>

                {/* Blockchain proof rows */}
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
                      href={`https://whatsonchain.com/tx/${result.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline break-all inline-flex items-center gap-1"
                    >
                      {result.txid}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <CopyBtn text={result.txid} />
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
                    <span className="font-mono break-all dark:text-slate-300 text-slate-600">{result.uhrpUrl}</span>
                    <CopyBtn text={result.uhrpUrl} />
                  </span>

                  {/* Hash */}
                  <span className="dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                    Hash
                    <Tip
                      title="Integrity Verification"
                      points={[
                        'SHA-256 hash recorded on-chain at upload',
                        'Hash recalculated after download by recipient',
                        'Match confirms file was not altered in transit',
                      ]}
                    />
                  </span>
                  <span className="inline-flex items-center gap-1.5 dark:text-slate-300 text-slate-600">
                    SHA-256 verified
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </span>

                  {/* Stored */}
                  {result.providerCount > 0 && (
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
                        {result.providerCount} provider{result.providerCount !== 1 ? 's' : ''}
                        {result.providerNames.length > 0 && result.providerNames.map((u, i) => (
                          <span key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500">{u}</span>
                        ))}
                      </span>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-sm text-rose-400 mt-4">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
