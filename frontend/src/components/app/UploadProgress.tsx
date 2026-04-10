import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { CheckCircle2, Circle, Loader2, XCircle, Info, Copy, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatTimestamp } from '@/lib/utils'
import { ease, successDetailRow, successStagger } from '@/lib/motion'
import type { UploadStep, UploadResult } from './PatientDashboard'

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

interface UploadProgressProps {
  step: UploadStep
  error: string | null
  result: UploadResult | null
  recipientName: string | null
  failedStep: UploadStep | null
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

export default function UploadProgress({ step, error, result, recipientName, failedStep }: UploadProgressProps) {
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
                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/step:opacity-100 group-hover/step:pointer-events-auto transition-opacity z-10">
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
                className="space-y-3 text-sm"
              >
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400">Txid</span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <a
                      href={`https://whatsonchain.com/tx/${result.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs break-all dark:text-slate-300 text-slate-600 hover:text-violet-600 dark:hover:text-violet-300 hover:underline"
                    >
                      {result.txid}
                    </a>
                    <CopyBtn text={result.txid} />
                  </span>
                </motion.div>
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                    UHRP URL
                    <span className="relative group/tip">
                      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-10">
                        <strong className="block text-xs mb-1.5">UHRP (Universal Hash Resolution Protocol)</strong>
                        <ul className="space-y-1">
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>URL derived from the file's SHA-256 hash</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>If the file changes, the URL breaks</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>Paste into a UHRP resolver to access independently</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>Only the recipient's wallet can decrypt</li>
                        </ul>
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs break-all dark:text-slate-300 text-slate-600">{result.uhrpUrl}</span>
                    <CopyBtn text={result.uhrpUrl} />
                  </span>
                </motion.div>
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400">To</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs dark:text-slate-300 text-slate-600 shrink-0">{recipientName || 'Unknown'}</span>
                    <span className="font-mono text-xs dark:text-slate-300 text-slate-600 truncate">{result.recipientKey}</span>
                    <CopyBtn text={result.recipientKey} />
                  </span>
                </motion.div>
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400">Time Sent</span>
                  <span className="text-xs dark:text-slate-300 text-slate-600">{formatTimestamp(result.timestamp)}</span>
                </motion.div>
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                    Expires
                    <span className="relative group/ret">
                      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/ret:opacity-100 group-hover/ret:pointer-events-auto transition-opacity z-10">
                        <strong className="block text-xs mb-1.5">Retention Expiry</strong>
                        <ul className="space-y-1">
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>Date your file's paid hosting period ends</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>Storage providers may remove the file after this</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>Extend by re-uploading before expiry</li>
                        </ul>
                      </span>
                    </span>
                  </span>
                  <span className="text-xs dark:text-slate-300 text-slate-600">{formatTimestamp(result.retentionExpiry)}</span>
                </motion.div>
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400 inline-flex items-center gap-1">
                    Stored
                    <span className="relative group/prov">
                      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help shrink-0" />
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 rounded-lg dark:bg-slate-800 bg-slate-900 text-white shadow-lg opacity-0 pointer-events-none group-hover/prov:opacity-100 group-hover/prov:pointer-events-auto transition-opacity z-10">
                        <strong className="block text-xs mb-1.5">Storage Providers</strong>
                        <ul className="space-y-1">
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>Independent UHRP nodes hosting your encrypted file</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>More providers = better redundancy</li>
                          <li className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300"><span className="text-violet-400 mt-0.5 shrink-0">&#8226;</span>If one goes offline, others still serve the data</li>
                        </ul>
                      </span>
                    </span>
                  </span>
                  <span className="text-xs dark:text-slate-300 text-slate-600">
                    {result.providerCount} provider{result.providerCount !== 1 ? 's' : ''}
                    {result.providerNames.length > 0 && (
                      <span>{': '}{result.providerNames.join(', ')}</span>
                    )}
                  </span>
                </motion.div>
                <motion.div variants={successDetailRow} className="grid grid-cols-[5.5rem_1fr] gap-x-3 items-baseline">
                  <span className="text-xs dark:text-slate-500 text-slate-400">Status</span>
                  <Badge variant="secondary" className="w-fit">ENCRYPTED</Badge>
                </motion.div>
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
