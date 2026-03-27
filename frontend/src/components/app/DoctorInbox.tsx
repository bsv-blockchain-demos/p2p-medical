import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { queryPendingTokens, type MedicalToken } from '@/services/tokens'
import { fetchProfile } from '@/services/identity'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatFileSize, formatTimestamp } from '@/lib/utils'
import ImageViewer from './ImageViewer'

export default function DoctorInbox() {
  const { identityKey } = useWallet()
  const [tokens, setTokens] = useState<MedicalToken[]>([])
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [selectedToken, setSelectedToken] = useState<MedicalToken | null>(null)

  const refresh = useCallback(async () => {
    if (!identityKey) return
    setLoading(true)
    try {
      const result = await queryPendingTokens(identityKey)
      setTokens(result)

      // Resolve sender names
      const uniqueKeys = [...new Set(result.map((t) => t.senderKey))]
      const names: Record<string, string> = {}
      await Promise.all(
        uniqueKeys.map(async (key) => {
          const profile = await fetchProfile(key)
          if (profile?.name) names[key] = profile.name
        }),
      )
      setSenderNames(names)
    } catch (err) {
      console.error('Failed to fetch inbox:', err)
    } finally {
      setLoading(false)
    }
  }, [identityKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (selectedToken) {
    return (
      <ImageViewer
        token={selectedToken}
        onBack={() => {
          setSelectedToken(null)
          refresh()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Incoming Medical Images</h2>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
          Refresh
        </Button>
      </div>

      {tokens.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center dark:text-slate-500 text-slate-400">
            No pending images. Check back later.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {tokens.map((token) => (
          <Card key={`${token.txid}:${token.vout}`} className="hover:shadow-violet-sm transition-all duration-200">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={token.status === 'accessed' ? 'success' : 'warning'}>
                      {token.status === 'pending' ? 'PENDING' : 'ATTESTED'}
                    </Badge>
                    <span className="text-xs dark:text-slate-500 text-slate-400">
                      {formatTimestamp(token.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="dark:text-slate-500 text-slate-400">From: </span>
                    {senderNames[token.senderKey] && (
                      <span className="font-medium mr-1.5">{senderNames[token.senderKey]}</span>
                    )}
                    <span className="font-mono text-xs text-violet-500 dark:text-violet-400/70 break-all">{token.senderKey}</span>
                  </p>
                  <p className="text-sm">
                    <span className="dark:text-slate-500 text-slate-400">Type: </span>
                    {token.metadata.fileType}
                    {token.metadata.bodyPart && ` · ${token.metadata.bodyPart}`}
                  </p>
                  <p className="text-sm">
                    <span className="dark:text-slate-500 text-slate-400">Size: </span>
                    {formatFileSize(token.metadata.fileSizeBytes)}
                  </p>
                  <p className="text-sm">
                    <span className="dark:text-slate-500 text-slate-400">Token: </span>
                    <a href={`https://whatsonchain.com/tx/${token.txid}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-violet-500 dark:text-violet-400/70 break-all hover:underline">{token.txid}</a>
                  </p>
                </div>

                {token.status === 'pending' && (
                  <Button size="sm" onClick={() => setSelectedToken(token)}>
                    View
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
