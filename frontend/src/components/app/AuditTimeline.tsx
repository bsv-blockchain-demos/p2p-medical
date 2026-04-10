import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { queryAuditTrail, resolveNames, type AuditEvent, type MedicalToken } from '@/services/tokens'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { truncateKey, formatFileSize } from '@/lib/utils'
import { fadeInUp, slideInRight } from '@/lib/motion'
import ImageViewer from './ImageViewer'

type FilterType = 'all' | 'encrypted' | 'decrypted'
type FilterPeriod = '7' | '30' | '90' | 'all'

const COLUMNS = [
  { key: 'uhrp', label: 'UHRP', width: 'w-[13%]' },
  { key: 'name', label: 'FROM', width: 'w-[12%]' },
  { key: 'sentTo', label: 'TO', width: 'w-[12%]' },
  { key: 'txid', label: 'TXID', width: 'w-[13%]' },
  { key: 'file', label: 'FILE', width: 'w-[14%]' },
  { key: 'date', label: 'DATE (UTC)', width: 'w-[20%]' },
  { key: 'status', label: 'STATUS', width: 'w-[16%]' },
] as const

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

      // Resolve counterparty + recipient names
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

  if (selectedEntry) {
    return (
      <motion.div variants={slideInRight} initial="hidden" animate="show">
        <ImageViewer
          token={auditEventToToken(selectedEntry.upload, selectedEntry.latestStatus)}
          onBack={() => setSelectedEntry(null)}
          backLabel="Back to History"
        />
      </motion.div>
    )
  }

  const search = searchTerm.toLowerCase()

  // Deduplicate by UHRP URL: one row per file, latest status wins
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
        // Keep the upload event for display data (timestamp = time sent)
        if (entry.event === 'upload' && existing.upload.event !== 'upload') {
          existing.upload = entry
        }
        // If any event is 'access' or 'view', status is decrypted
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
      const haystack = [
        upload.txid,
        upload.senderKey,
        upload.recipientKey,
        upload.uhrpUrl,
        cpName,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">History</h2>

      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by txid, identity key, or UHRP URL..."
          className="flex-1 min-w-[250px] rounded-lg border dark:border-slate-700 border-slate-200 bg-transparent px-3 py-2 text-sm dark:text-slate-200 text-slate-700 placeholder:dark:text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
        >
          <option value="all">All statuses</option>
          <option value="encrypted">Encrypted only</option>
          <option value="decrypted">Decrypted only</option>
        </Select>
        <Select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b-2 border-violet-500/20">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-1.5 py-2 text-left text-[10px] font-semibold tracking-wider uppercase dark:text-slate-400 text-slate-500 ${col.width}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-1.5 py-8 text-center dark:text-slate-500 text-slate-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-1.5 py-8 text-center dark:text-slate-500 text-slate-400">
                      No audit entries found.
                    </td>
                  </tr>
                )}
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
                      className="border-b dark:border-slate-800/50 border-slate-100 last:border-0 hover:dark:bg-slate-800/30 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-1.5 py-2 truncate">
                        <span className="inline-flex items-center gap-0.5">
                          {entry.uhrpUrl ? (
                            <button
                              onClick={() => setSelectedEntry({ upload: entry, latestStatus })}
                              className="font-mono text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline text-left"
                              title={entry.uhrpUrl}
                            >
                              {truncateKey(entry.uhrpUrl, 3)}
                            </button>
                          ) : (
                            <span className="font-mono dark:text-slate-500 text-slate-400">-</span>
                          )}
                          {entry.uhrpUrl && <CopyButton text={entry.uhrpUrl} />}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 dark:text-slate-300 text-slate-600 truncate" title={entry.senderKey === identityKey ? 'You' : cpName}>
                        {entry.senderKey === identityKey
                          ? 'You'
                          : cpName || '—'}
                      </td>
                      <td className="px-1.5 py-2 dark:text-slate-300 text-slate-600 truncate" title={entry.recipientKey === identityKey ? 'You' : (names.get(entry.recipientKey) || entry.recipientKey)}>
                        {entry.recipientKey === identityKey
                          ? 'You'
                          : names.get(entry.recipientKey) || truncateKey(entry.recipientKey, 3)}
                      </td>
                      <td className="px-1.5 py-2 truncate">
                        <span className="inline-flex items-center gap-0.5">
                          <a
                            href={`https://whatsonchain.com/tx/${entry.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:underline"
                            title={entry.txid}
                          >
                            {truncateKey(entry.txid, 3)}
                          </a>
                          {entry.txid && <CopyButton text={entry.txid} />}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 dark:text-slate-300 text-slate-600 truncate">
                        {entry.metadata.fileType}
                        <span className="dark:text-slate-500 text-slate-400 ml-1">
                          {formatFileSize(entry.metadata.fileSizeBytes)}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 dark:text-slate-300 text-slate-600 whitespace-nowrap">
                        {formatDateCompact(entry.timestamp)}
                      </td>
                      <td className="px-1.5 py-2">
                        <Badge
                          variant={latestStatus === 'decrypted' ? 'success' : 'secondary'}
                        >
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
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

function getCounterpartyKey(entry: AuditEvent, identityKey: string): string {
  // Show the OTHER party — if I'm the sender, show recipient; if I'm the recipient, show sender
  if (entry.senderKey === identityKey) {
    return entry.recipientKey
  }
  return entry.senderKey
}
