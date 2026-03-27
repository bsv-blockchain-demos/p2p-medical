import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Circle, Shield, Download } from 'lucide-react'
import { downloadFromUHRP } from '@/services/storage'
import { decryptFromSender, hashContent } from '@/services/crypto'
import { confirmTokenAccess, type MedicalToken } from '@/services/tokens'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatFileSize, formatTimestamp } from '@/lib/utils'

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
        const mimeType = token.metadata.mimeType || 'image/jpeg'
        const blob = new Blob([plaintext.buffer as ArrayBuffer], { type: mimeType })
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
      const result = await confirmTokenAccess(token.txid, token.vout, token.recipientKey)
      setReceiptTxid(result.txid)
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

      {/* File display */}
      {imageUrl && (
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
      )}

      {/* Details */}
      {step === 'done' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">File Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="dark:text-slate-500 text-slate-400">From:</span> <span className="font-mono text-xs text-violet-500 dark:text-violet-400/70 break-all">{token.senderKey}</span></p>
              <p><span className="dark:text-slate-500 text-slate-400">Type:</span> {token.metadata.fileType}{token.metadata.bodyPart && ` · ${token.metadata.bodyPart}`}</p>
              <p><span className="dark:text-slate-500 text-slate-400">Size:</span> {formatFileSize(token.metadata.fileSizeBytes)}</p>
              <p><span className="dark:text-slate-500 text-slate-400">Hash:</span> <span className={hashMatch ? 'text-violet-400' : 'text-rose-400'}>SHA-256 {hashMatch ? 'verified' : 'mismatch'}</span></p>
              <p><span className="dark:text-slate-500 text-slate-400">Sent:</span> {formatTimestamp(token.timestamp)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" />
                Blockchain Proof
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="dark:text-slate-500 text-slate-400">Upload Tx:</span> <a href={`https://whatsonchain.com/tx/${token.txid}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-violet-500 dark:text-violet-400/70 break-all hover:underline">{token.txid}</a></p>
              <p>
                <span className="dark:text-slate-500 text-slate-400">Status:</span>{' '}
                <Badge variant={receiptTxid ? 'success' : 'warning'}>
                  {receiptTxid ? 'Accessed' : 'Pending'}
                </Badge>
              </p>
              {receiptTxid && (
                <p><span className="dark:text-slate-500 text-slate-400">Attestation Tx:</span> <a href={`https://whatsonchain.com/tx/${receiptTxid}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-violet-500 dark:text-violet-400/70 break-all hover:underline">{receiptTxid}</a></p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Spend / Confirm button */}
      {step === 'done' && !receiptTxid && (
        <div className="flex justify-center">
          <Button size="lg" onClick={handleSpend} disabled={spending}>
            {spending ? 'Attesting...' : 'Attest Viewing'}
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
