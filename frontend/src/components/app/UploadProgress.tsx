import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { UploadStep } from './PatientDashboard'

interface UploadProgressProps {
  step: UploadStep
  error: string | null
}

const steps: { id: UploadStep; label: string }[] = [
  { id: 'encrypting', label: 'Encrypting image' },
  { id: 'uploading', label: 'Uploading to UHRP/S3' },
  { id: 'minting', label: 'Minting blockchain token' },
  { id: 'notifying', label: 'Sending notification' },
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

export default function UploadProgress({ step, error }: UploadProgressProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4 text-xs tracking-widest uppercase text-violet-500 dark:text-violet-400 font-body">
          {step === 'done' ? 'COMPLETE' : step === 'error' ? 'ERROR' : 'PROGRESS'}
        </h3>
        <div className="space-y-3">
          {steps.map(({ id, label }) => {
            const status = getStepStatus(step, id)
            return (
              <div key={id} className="flex items-center gap-3 text-sm">
                {status === 'done' && (
                  <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                )}
                {status === 'active' && (
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
                )}
                {status === 'waiting' && (
                  <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                )}
                {status === 'error' && (
                  <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                )}
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
                  {status === 'done' && (
                    <span className="dark:text-slate-500 text-slate-400 ml-2">done</span>
                  )}
                  {status === 'active' && (
                    <span className="dark:text-slate-500 text-slate-400 ml-2">in progress</span>
                  )}
                  {status === 'waiting' && (
                    <span className="dark:text-slate-700 text-slate-300 ml-2">waiting</span>
                  )}
                </span>
              </div>
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
