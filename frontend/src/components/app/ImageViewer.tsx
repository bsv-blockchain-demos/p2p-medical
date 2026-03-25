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
                  {s === 'done' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  {s === 'active' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  {s === 'waiting' && <Circle className="w-5 h-5 text-muted-foreground/30" />}
                  <span>
                    {label}
                    {s === 'done' && id === 'verifying' && hashMatch && (
                      <span className="text-green-600 ml-1">match</span>
                    )}
                    {s === 'done' && <span className="text-muted-foreground ml-2">done</span>}
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
              className="max-w-full max-h-[500px] rounded-lg shadow-md"
            />
          </CardContent>
        </Card>
      )}

      {/* Details */}
      {step === 'done' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">FILE DETAILS</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">From:</span> <span className="font-mono">{truncateKey(token.senderKey)}</span></p>
              <p><span className="text-muted-foreground">Type:</span> {token.metadata.fileType}{token.metadata.bodyPart && `, ${token.metadata.bodyPart}`}</p>
              <p><span className="text-muted-foreground">Size:</span> {formatFileSize(token.metadata.fileSizeBytes)}</p>
              <p><span className="text-muted-foreground">Hash:</span> SHA-256 {hashMatch ? '✓' : '✗'}</p>
              <p><span className="text-muted-foreground">Sent:</span> {formatTimestamp(token.timestamp)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                BLOCKCHAIN PROOF
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Upload Tx:</span> <span className="font-mono text-xs">{truncateKey(token.txid)}</span></p>
              <p>
                <span className="text-muted-foreground">Status:</span>{' '}
                <Badge variant={receiptTxid ? 'success' : 'secondary'}>
                  {receiptTxid ? 'Viewed' : 'Pending'}
                </Badge>
              </p>
              {receiptTxid && (
                <p><span className="text-muted-foreground">Receipt:</span> <span className="font-mono text-xs">{truncateKey(receiptTxid)}</span></p>
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
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
    </div>
  )
}
