import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import { queryAuditTrail, type MedicalToken } from '@/services/tokens'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { truncateKey } from '@/lib/utils'

type FilterType = 'all' | 'upload' | 'accessed'
type FilterPeriod = '7' | '30' | '90' | 'all'

export default function AuditTimeline() {
  const { identityKey } = useWallet()
  const [entries, setEntries] = useState<MedicalToken[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('30')

  const refresh = useCallback(async () => {
    if (!identityKey) return
    setLoading(true)
    try {
      const result = await queryAuditTrail(identityKey)
      setEntries(result)
    } catch (err) {
      console.error('Failed to fetch audit trail:', err)
    } finally {
      setLoading(false)
    }
  }, [identityKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = entries.filter((entry) => {
    if (filterType !== 'all' && entry.eventType !== filterType) return false
    if (filterPeriod !== 'all') {
      const days = parseInt(filterPeriod)
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      if (entry.timestamp < cutoff) return false
    }
    return true
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, MedicalToken[]>>((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display">Audit Log</h2>

      <div className="flex gap-4">
        <div>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
          >
            <option value="all">All types</option>
            <option value="upload">Uploads only</option>
            <option value="accessed">Accessed only</option>
          </Select>
        </div>
        <div>
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
      </div>

      {loading && (
        <Card>
          <CardContent className="py-8 text-center dark:text-slate-500 text-slate-400">Loading...</CardContent>
        </Card>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center dark:text-slate-500 text-slate-400">
            No audit entries found.
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <Card key={date}>
          <CardContent className="pt-6">
            <h3 className="text-xs font-semibold text-violet-500/60 dark:text-violet-400/60 tracking-widest uppercase mb-4 font-body">{date}</h3>
            <div className="space-y-4">
              {items.map((entry) => (
                <div
                  key={`${entry.txid}:${entry.vout}`}
                  className="flex items-start gap-4 pb-4 border-b dark:border-slate-800/50 border-slate-200 last:border-0 last:pb-0"
                >
                  <div className="text-xs dark:text-slate-500 text-slate-400 w-12 flex-shrink-0 pt-0.5">
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {entry.eventType === 'upload' ? 'UPLOADED' : 'ACCESSED'}
                      </span>
                      <Badge
                        variant={
                          entry.status === 'pending'
                            ? 'default'
                            : entry.status === 'accessed'
                              ? 'success'
                              : 'secondary'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </div>
                    <p className="text-sm dark:text-slate-500 text-slate-400">
                      {entry.metadata.fileType}
                      {entry.metadata.bodyPart && ` · ${entry.metadata.bodyPart}`}
                    </p>
                    <p className="text-xs dark:text-slate-500 text-slate-400">
                      {entry.eventType === 'upload' ? 'To' : 'By'}:{' '}
                      <span className="font-mono text-violet-500 dark:text-violet-400/70">{truncateKey(entry.recipientKey)}</span>
                    </p>
                    <p className="text-xs dark:text-slate-500 text-slate-400">
                      Tx: <span className="font-mono text-violet-500 dark:text-violet-400/70">{truncateKey(entry.txid)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
