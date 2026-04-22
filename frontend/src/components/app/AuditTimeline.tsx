import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Shield, Lock, Search, RefreshCw, Copy, Check } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { queryAuditTrail, resolveNames, type AuditEvent, type MedicalToken } from '@/services/tokens'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn, truncateKey, formatFileSize } from '@/lib/utils'
import { fadeInUp, slideInRight } from '@/lib/motion'
import ImageViewer from './ImageViewer'

// --- Helpers ---

type FilterType = 'all' | 'encrypted' | 'decrypted'
type FilterPeriod = '7' | '30' | '90' | 'all'

const FILE_TYPE_LABELS: Record<string, string> = { xray: 'X-Ray', scan: 'Scan', report: 'Report', other: 'File' }

const STATUS_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'encrypted', label: 'Encrypted' },
  { value: 'decrypted', label: 'Decrypted' },
]

interface DeduplicatedEntry {
  upload: AuditEvent
  latestStatus: 'encrypted' | 'decrypted'
}

function formatDateCompact(ts: number): string {
  const d = new Date(ts)
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const h = d.getUTCHours()
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${mon} ${day}, ${d.getUTCFullYear()}, ${h12}:${m} ${ampm}`
}

function auditEventToToken(entry: AuditEvent, status: 'encrypted' | 'decrypted'): MedicalToken {
  return {
    eventType: entry.event === 'upload' ? 'upload' : 'decrypted',
    contentHash: entry.contentHash,
    uhrpUrl: entry.uhrpUrl,
    senderKey: entry.senderKey,
    recipientKey: entry.recipientKey,
    metadata: entry.metadata,
    keyID: entry.keyID,
    txid: entry.txid,
    vout: 0,
    status,
    timestamp: entry.timestamp,
  }
}

function getCounterpartyKey(entry: AuditEvent, identityKey: string): string {
  if (entry.senderKey === identityKey) return entry.recipientKey
  return entry.senderKey
}

// --- Component ---

export default function AuditTimeline() {
  const { identityKey } = useWallet()
  const [entries, setEntries] = useState<AuditEvent[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('30')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<DeduplicatedEntry | null>(null)

  const refresh = useCallback(async () => {
    if (!identityKey) return
    setLoading(true)
    try {
      const result = await queryAuditTrail(identityKey)
      setEntries(result)

      const keysToResolve = new Set<string>()
      for (const e of result) {
        keysToResolve.add(getCounterpartyKey(e, identityKey || ''))
        if (e.recipientKey && e.recipientKey !== identityKey) keysToResolve.add(e.recipientKey)
      }
      const resolved = await resolveNames(Array.from(keysToResolve))
      setNames(resolved)
    } catch (err) {
      console.error('Failed to fetch audit trail:', err)
    } finally {
      setLoading(false)
    }
  }, [identityKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  // --- ImageViewer view ---
  if (selectedEntry) {
    return (
      <motion.div variants={slideInRight} initial="hidden" animate="show">
        <ImageViewer
          token={auditEventToToken(selectedEntry.upload, selectedEntry.latestStatus)}
          onBack={() => setSelectedEntry(null)}
          backLabel="Back to Audit Trail"
        />
      </motion.div>
    )
  }

  // --- Deduplication & filtering ---
  const search = searchTerm.toLowerCase()

  const deduped: DeduplicatedEntry[] = (() => {
    const map = new Map<string, DeduplicatedEntry>()
    for (const entry of entries) {
      const key = entry.uhrpUrl
      if (!key) continue
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          upload: entry.event === 'upload' ? entry : entry,
          latestStatus: entry.event === 'access' || entry.event === 'view' ? 'decrypted' : 'encrypted',
        })
      } else {
        if (entry.event === 'upload' && existing.upload.event !== 'upload') {
          existing.upload = entry
        }
        if (entry.event === 'access' || entry.event === 'view') {
          existing.latestStatus = 'decrypted'
        }
      }
    }
    return Array.from(map.values())
  })()

  const filtered = deduped.filter(({ upload, latestStatus }) => {
    if (filterType !== 'all' && latestStatus !== filterType) return false
    if (filterPeriod !== 'all') {
      const days = parseInt(filterPeriod)
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      if (upload.timestamp < cutoff) return false
    }
    if (search) {
      const cpKey = getCounterpartyKey(upload, identityKey || '')
      const cpName = names.get(cpKey) || ''
      const haystack = [upload.txid, upload.senderKey, upload.recipientKey, upload.uhrpUrl, cpName]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  const isFiltered = searchTerm || filterType !== 'all' || filterPeriod !== 'all'
  const showingDiffers = isFiltered && filtered.length !== deduped.length

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Audit Trail</h2>
              <p className="text-sm text-muted-foreground">Full history of shared and accessed medical files</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2 shrink-0">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin text-violet-400')} />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-violet-500" /> End-to-end encrypted</span>
          <span className="text-slate-300 dark:text-slate-600">&middot;</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-violet-500" /> Blockchain-verified</span>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by txid, name, or UHRP..."
            className="w-full rounded-lg border dark:border-slate-700 border-slate-200 bg-transparent pl-9 pr-3 py-2 text-sm dark:text-slate-200 text-slate-700 placeholder:dark:text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        {/* Segmented status pills */}
        <div className="inline-flex items-center rounded-lg border dark:border-slate-700 border-slate-200 p-0.5">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setFilterType(sf.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                filterType === sf.value
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>

        <Select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
          className="w-auto h-8 text-xs"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>

      {/* ── Result Count ── */}
      {showingDiffers && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {deduped.length} entries</span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <Card className="hover:translate-y-0 hover:shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs min-w-[700px]">
              <thead>
                <tr className="border-b dark:border-slate-800 border-slate-200">
                  <th className="w-[13%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">UHRP</th>
                  <th className="w-[12%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">From</th>
                  <th className="w-[12%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">To</th>
                  <th className="w-[13%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">TXID</th>
                  <th className="w-[14%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">File</th>
                  <th className="w-[20%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Date</th>
                  <th className="w-[16%] px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading skeleton */}
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-b dark:border-slate-800/50 border-slate-100 last:border-0">
                    <td className="px-3 py-2.5"><div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                    <td className="px-3 py-2.5"><div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                    <td className="px-3 py-2.5"><div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  </tr>
                ))}

                {/* Empty state */}
                <AnimatePresence>
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-16">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center text-center"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                            <Clock className="w-7 h-7 text-violet-400" />
                          </div>
                          <h3 className="font-semibold text-lg mb-1">
                            {searchTerm ? 'No matching entries' : 'No audit entries yet'}
                          </h3>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            {searchTerm
                              ? 'Try adjusting your search or filters'
                              : 'When medical files are shared or accessed, they will appear here'}
                          </p>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>

                {/* Data rows */}
                {!loading && filtered.map(({ upload: entry, latestStatus }, i) => {
                  const cpKey = getCounterpartyKey(entry, identityKey || '')
                  const cpName = names.get(cpKey) || ''

                  return (
                    <motion.tr
                      key={entry.uhrpUrl}
                      variants={fadeInUp}
                      initial="hidden"
                      animate="show"
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        'border-b dark:border-slate-800/50 border-slate-100 last:border-0 cursor-pointer transition-colors',
                        'hover:bg-violet-50/50 dark:hover:bg-violet-500/5',
                        i % 2 === 1 && 'bg-slate-50/50 dark:bg-slate-800/20'
                      )}
                      onClick={() => setSelectedEntry({ upload: entry, latestStatus })}
                    >
                      {/* UHRP */}
                      <td className="px-3 py-2.5 truncate">
                        <span className="inline-flex items-center gap-0.5">
                          {entry.uhrpUrl ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedEntry({ upload: entry, latestStatus }) }}
                              className="font-mono text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline text-left"
                              title={entry.uhrpUrl}
                            >
                              {truncateKey(entry.uhrpUrl, 3)}
                            </button>
                          ) : (
                            <span className="font-mono dark:text-slate-500 text-slate-400">-</span>
                          )}
                          {entry.uhrpUrl && <span onClick={(e) => e.stopPropagation()}><CopyButton text={entry.uhrpUrl} /></span>}
                        </span>
                      </td>

                      {/* FROM */}
                      <td className="px-3 py-2.5 dark:text-slate-300 text-slate-600 truncate" title={entry.senderKey === identityKey ? 'You' : cpName}>
                        {entry.senderKey === identityKey ? 'You' : cpName || '—'}
                      </td>

                      {/* TO */}
                      <td className="px-3 py-2.5 dark:text-slate-300 text-slate-600 truncate" title={entry.recipientKey === identityKey ? 'You' : (names.get(entry.recipientKey) || entry.recipientKey)}>
                        {entry.recipientKey === identityKey
                          ? 'You'
                          : names.get(entry.recipientKey) || truncateKey(entry.recipientKey, 3)}
                      </td>

                      {/* TXID */}
                      <td className="px-3 py-2.5 truncate">
                        <span className="inline-flex items-center gap-0.5">
                          <a
                            href={`https://whatsonchain.com/tx/${entry.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline"
                            title={entry.txid}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {truncateKey(entry.txid, 3)}
                          </a>
                          {entry.txid && <span onClick={(e) => e.stopPropagation()}><CopyButton text={entry.txid} /></span>}
                        </span>
                      </td>

                      {/* FILE */}
                      <td className="px-3 py-2.5 dark:text-slate-300 text-slate-600 truncate">
                        {FILE_TYPE_LABELS[entry.metadata.fileType] || entry.metadata.fileType}
                        <span className="dark:text-slate-500 text-slate-400 ml-1">
                          {formatFileSize(entry.metadata.fileSizeBytes)}
                        </span>
                      </td>

                      {/* DATE */}
                      <td className="px-3 py-2.5 dark:text-slate-300 text-slate-600 whitespace-nowrap">
                        {formatDateCompact(entry.timestamp)}
                      </td>

                      {/* STATUS */}
                      <td className="px-3 py-2.5">
                        <Badge variant={latestStatus === 'decrypted' ? 'success' : 'secondary'}>
                          {latestStatus === 'decrypted' ? 'DECRYPTED' : 'ENCRYPTED'}
                        </Badge>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Sub-components ---

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-2.5 h-2.5 text-emerald-500" />
      ) : (
        <Copy className="w-2.5 h-2.5 dark:text-slate-500 text-slate-400" />
      )}
    </button>
  )
}
