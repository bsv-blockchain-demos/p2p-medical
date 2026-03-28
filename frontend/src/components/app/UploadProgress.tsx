import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ease } from '@/lib/motion'
import type { UploadStep } from './PatientDashboard'

interface UploadProgressProps {
  step: UploadStep
  error: string | null
}

const steps: { id: UploadStep; label: string }[] = [
  { id: 'encrypting', label: 'Encrypting file' },
  { id: 'uploading', label: 'Uploading to UHRP (Universal Hash Resolution Protocol)' },
  { id: 'minting', label: 'Minting blockchain token (immutable proof-of-share)' },
  { id: 'notifying', label: 'Sending notification to recipient' },
]

const stepOrder = ['encrypting', 'uploading', 'minting', 'notifying', 'done']

function getStepStatus(
  currentStep: UploadStep,
  targetStep: UploadStep,
): 'done' | 'active' | 'waiting' | 'error' {
  if (currentStep === 'error') {
    const currentIdx = stepOrder.indexOf(targetStep)
    const errorIdx = stepOrder.indexOf(currentStep)
    if (currentIdx < errorIdx) return 'done'
    return 'error'
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

export default function UploadProgress({ step, error }: UploadProgressProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className={`font-semibold mb-4 text-xs tracking-widest uppercase ${
          step === 'done'
            ? 'text-emerald-600 dark:text-emerald-400'
            : step === 'error'
              ? 'text-rose-500 dark:text-rose-400'
              : 'text-violet-500 dark:text-violet-400'
        }`}>
          {step === 'done' ? 'COMPLETE' : step === 'error' ? 'ERROR' : 'PROGRESS'}
        </h3>
        <div className="space-y-3">
          {steps.map(({ id, label }, i) => {
            const status = getStepStatus(step, id)
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
                    className={
                      status === 'active'
                        ? 'dark:text-white text-slate-900'
                        : status === 'done'
                          ? 'dark:text-slate-300 text-slate-600'
                          : status === 'waiting'
                            ? 'text-slate-600'
                            : 'text-rose-400'
                    }
                  >
                    {label}
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
        {error && (
          <p className="text-sm text-rose-400 mt-4">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
