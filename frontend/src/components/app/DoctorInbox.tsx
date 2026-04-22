import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Inbox, Lock, Shield, Eye, ExternalLink, Copy, Check, HardDrive } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { queryPendingTokens, type MedicalToken } from '@/services/tokens'
import { fetchProfile } from '@/services/identity'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { truncateKey, formatFileSize, formatTimestamp } from '@/lib/utils'
import { staggerContainer, fadeInUp, slideInRight } from '@/lib/motion'
import ImageViewer from './ImageViewer'

const FILE_TYPE_LABELS: Record<string, string> = {
  xray: 'X-Ray',
  scan: 'Scan',
  report: 'Report',
  other: 'Other',
}

export default function DoctorInbox() {
  const { identityKey } = useWallet()
  const [tokens, setTokens] = useState<MedicalToken[]>([])
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [selectedToken, setSelectedToken] = useState<MedicalToken | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyKey = useCallback((key: string) => {
    void navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }, [])

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
      {/* Page header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Incoming Medical Files</h2>
              <p className="text-sm text-muted-foreground">Encrypted files shared directly to your wallet</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-violet-500" /> End-to-end encrypted</span>
          <span className="text-slate-300 dark:text-slate-600">&middot;</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-violet-500" /> Blockchain-verified</span>
          <span className="text-slate-300 dark:text-slate-600">&middot;</span>
          <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-violet-500" /> Only you can decrypt</span>
        </div>
      </div>

      {/* Empty state */}
      <AnimatePresence mode="wait">
        {tokens.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <Inbox className="w-7 h-7 text-violet-400" />
                </div>
                <h3 className="font-semibold text-lg mb-1">No files yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Encrypted medical files shared with you will appear here
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token cards */}
      <motion.div
        className="space-y-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {tokens.map((token) => {
          const senderName = senderNames[token.senderKey]
          const initial = senderName ? senderName[0].toUpperCase() : '?'
          const fileTypeLabel = FILE_TYPE_LABELS[token.metadata.fileType] || token.metadata.fileType

          return (
            <motion.div key={`${token.txid}:${token.vout}`} variants={fadeInUp}>
              <Card className="hover:shadow-violet-sm transition-all duration-200">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-start gap-4">
                    {/* Sender avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                      {initial}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Top row: sender + timestamp + badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {senderName || truncateKey(token.senderKey, 8)}
                          </div>
                          <button
                            onClick={() => copyKey(token.senderKey)}
                            className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy public key"
                          >
                            {truncateKey(token.senderKey, 8)}
                            {copiedKey === token.senderKey
                              ? <Check className="w-3 h-3 text-emerald-500" />
                              : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={token.status === 'decrypted' ? 'success' : 'secondary'}>
                            {token.status === 'encrypted' ? 'ENCRYPTED' : 'DECRYPTED'}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(token.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Metadata pills */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                          {fileTypeLabel}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                          {formatFileSize(token.metadata.fileSizeBytes)}
                        </span>
                        {token.metadata.bodyPart && (
                          <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                            {token.metadata.bodyPart}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                          <HardDrive className="w-3 h-3" />
                          {(token.metadata.providerCount ?? 1) === 1 ? '1 Provider' : `${token.metadata.providerCount} Providers`}
                        </span>
                      </div>

                      {/* Bottom row: txid + view button */}
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground break-all">
                          Txid:{' '}
                          <a
                            href={`https://whatsonchain.com/tx/${token.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline inline-flex items-center gap-1"
                          >
                            {token.txid}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </span>

                        {token.status === 'encrypted' && (
                          <Button size="sm" onClick={() => setSelectedToken(token)} className="gap-1.5 shrink-0">
                            <Eye className="w-3.5 h-3.5" />
                            View &amp; Decrypt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
