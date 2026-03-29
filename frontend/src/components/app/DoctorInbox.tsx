import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { queryPendingTokens, type MedicalToken } from '@/services/tokens'
import { fetchProfile } from '@/services/identity'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatFileSize, formatTimestamp } from '@/lib/utils'
import { staggerContainer, fadeInUp, slideInRight } from '@/lib/motion'
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
      <motion.div
        variants={slideInRight}
        initial="hidden"
        animate="show"
      >
        <ImageViewer
          token={selectedToken}
          onBack={() => {
            setSelectedToken(null)
            refresh()
          }}
        />
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Incoming Medical Files</h2>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
          Refresh
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {tokens.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="py-12 text-center dark:text-slate-500 text-slate-400">
                No encrypted images. Check back later.
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="space-y-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {tokens.map((token) => (
          <motion.div key={`${token.txid}:${token.vout}`} variants={fadeInUp}>
            <Card className="hover:shadow-violet-sm transition-all duration-200">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs dark:text-slate-500 text-slate-400">
                        {formatTimestamp(token.timestamp)}
                      </span>
                      <Badge variant={token.status === 'decrypted' ? 'success' : 'secondary'}>
                        {token.status === 'encrypted' ? 'ENCRYPTED' : 'DECRYPTED'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                      <span className="font-medium dark:text-slate-400 text-slate-500">From</span>
                      <div className="min-w-0">
                        {senderNames[token.senderKey] && (
                          <span className="font-semibold dark:text-slate-200 text-slate-700 mr-2">{senderNames[token.senderKey]}</span>
                        )}
                        <span className="font-mono text-xs dark:text-slate-500 text-slate-400 break-all">{token.senderKey}</span>
                      </div>
                      <span className="font-medium dark:text-slate-400 text-slate-500">Type</span>
                      <span className="dark:text-slate-300 text-slate-600">
                        {token.metadata.fileType}
                        {token.metadata.bodyPart && ` · ${token.metadata.bodyPart}`}
                      </span>
                      <span className="font-medium dark:text-slate-400 text-slate-500">Size</span>
                      <span className="dark:text-slate-300 text-slate-600">{formatFileSize(token.metadata.fileSizeBytes)}</span>
                      <span className="font-medium dark:text-slate-400 text-slate-500">Token</span>
                      <a
                        href={`https://whatsonchain.com/tx/${token.txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline break-all"
                      >
                        {token.txid}
                      </a>
                    </div>
                  </div>

                  {token.status === 'encrypted' && (
                    <Button size="sm" onClick={() => setSelectedToken(token)} className="shrink-0">
                      View
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
