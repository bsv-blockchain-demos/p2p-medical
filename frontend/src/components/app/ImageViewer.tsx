import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Circle, Shield } from 'lucide-react'
import { downloadFromUHRP } from '@/services/storage'
import { decryptFromSender, hashContent } from '@/services/crypto'
import { spendTokenAndMintReceipt, type MedicalToken } from '@/services/tokens'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { truncateKey, formatFileSize, formatTimestamp } from '@/lib/utils'

interface ImageViewerProps {
  token: MedicalToken
  onBack: () => void
}

type ViewStep = 'downloading' | 'verifying' | 'decrypting' | 'done' | 'error'

export default function ImageViewer({ token, onBack }: ImageViewerProps) {
  const [step, setStep] = useState<ViewStep>('downloading')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hashMatch, setHashMatch] = useState<boolean | null>(null)
  const [spending, setSpending] = useState(false)
  const [receiptTxid, setReceiptTxid] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadImage() {
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
          setStep('error')
          setError('Content hash mismatch — file may be tampered')
          return
        }
        if (cancelled) return

        // 3. Decrypt
        setStep('decrypting')
        const plaintext = await decryptFromSender(
          encrypted,
          token.senderKey,
          token.keyID,
        )
        if (cancelled) return

        // 4. Create object URL for display
        const blob = new Blob([plaintext.buffer as ArrayBuffer], { type: token.metadata.mimeType || 'image/jpeg' })
        setImageUrl(URL.createObjectURL(blob))
        setStep('done')
      } catch (err) {
        if (!cancelled) {
          setStep('error')
          setError(err instanceof Error ? err.message : 'Failed to load image')
        }
      }
    }

    loadImage()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSpend = async () => {
    setSpending(true)
    try {
      const result = await spendTokenAndMintReceipt(token.txid, token.vout, token)
      setReceiptTxid(result.txid || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm access')
    } finally {
      setSpending(false)
    }
  }

  const stepStatus = (target: ViewStep) => {
    const order = ['downloading', 'verifying', 'decrypting', 'done']
    const ci = order.indexOf(step === 'error' ? 'done' : step)
    const ti = order.indexOf(target)
    if (ti < ci) return 'done'
    if (ti === ci) return step === 'error' ? 'error' : 'active'
    return 'waiting'
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Inbox
      </Button>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {[
              { id: 'downloading' as const, label: 'Downloading from UHRP' },
              { id: 'verifying' as const, label: 'Verifying content hash' },
              { id: 'decrypting' as const, label: 'Decrypting' },
            ].map(({ id, label }) => {
              const s = stepStatus(id)
              return (
                <div key={id} className="flex items-center gap-3 text-sm">
                  {s === 'done' && <CheckCircle2 className="w-5 h-5 text-violet-400" />}
                  {s === 'active' && <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />}
                  {s === 'waiting' && <Circle className="w-5 h-5 text-slate-600" />}
                  <span>
                    {label}
                    {s === 'done' && id === 'verifying' && hashMatch && (
                      <span className="text-violet-400 ml-1">verified</span>
                    )}
                    {s === 'done' && id === 'verifying' && hashMatch === false && (
                      <span className="text-rose-400 ml-1">mismatch</span>
                    )}
                    {s === 'done' && <span className="dark:text-slate-500 text-slate-400 ml-2">done</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Image display */}
      {imageUrl && (
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <img
              src={imageUrl}
              alt="Decrypted medical image"
              className="max-w-full max-h-[500px] rounded-lg ring-1 ring-violet-500/20"
            />
          </CardContent>
        </Card>
      )}

      {/* Details */}
      {step === 'done' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-body font-semibold">File Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="dark:text-slate-500 text-slate-400">From:</span> <span className="font-mono text-violet-500 dark:text-violet-400/70">{truncateKey(token.senderKey)}</span></p>
              <p><span className="dark:text-slate-500 text-slate-400">Type:</span> {token.metadata.fileType}{token.metadata.bodyPart && `, ${token.metadata.bodyPart}`}</p>
              <p><span className="dark:text-slate-500 text-slate-400">Size:</span> {formatFileSize(token.metadata.fileSizeBytes)}</p>
              <p><span className="dark:text-slate-500 text-slate-400">Hash:</span> <span className={hashMatch ? 'text-violet-400' : 'text-rose-400'}>SHA-256 {hashMatch ? 'verified' : 'mismatch'}</span></p>
              <p><span className="dark:text-slate-500 text-slate-400">Sent:</span> {formatTimestamp(token.timestamp)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-body font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" />
                Blockchain Proof
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="dark:text-slate-500 text-slate-400">Upload Tx:</span> <span className="font-mono text-xs text-violet-500 dark:text-violet-400/70">{truncateKey(token.txid)}</span></p>
              <p>
                <span className="dark:text-slate-500 text-slate-400">Status:</span>{' '}
                <Badge variant={receiptTxid ? 'success' : 'secondary'}>
                  {receiptTxid ? 'Viewed' : 'Pending'}
                </Badge>
              </p>
              {receiptTxid && (
                <p><span className="dark:text-slate-500 text-slate-400">Receipt:</span> <span className="font-mono text-xs text-violet-500 dark:text-violet-400/70">{truncateKey(receiptTxid)}</span></p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Spend / Confirm button */}
      {step === 'done' && !receiptTxid && (
        <div className="flex justify-center">
          <Button size="lg" onClick={handleSpend} disabled={spending}>
            {spending ? 'Confirming...' : 'Confirm Access (Spend Token)'}
          </Button>
        </div>
      )}

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="pt-6 text-sm text-rose-400">{error}</CardContent>
        </Card>
      )}
    </div>
  )
}
