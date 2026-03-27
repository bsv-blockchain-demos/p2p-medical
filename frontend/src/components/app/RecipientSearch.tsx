import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { searchIdentity, isValidPublicKey, type IdentityResult } from '@/services/identity'
import { truncateKey } from '@/lib/utils'

interface RecipientSearchProps {
  onSelect: (key: string, name?: string) => void
  selectedKey: string | null
  selectedName: string | null
}

export default function RecipientSearch({ onSelect, selectedKey, selectedName }: RecipientSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [pasteKey, setPasteKey] = useState('')
  const [results, setResults] = useState<IdentityResult[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const found = await searchIdentity(searchQuery)
      setResults(found)
    } finally {
      setSearching(false)
    }
  }

  const handlePaste = () => {
    const key = pasteKey.trim()
    if (isValidPublicKey(key)) {
      onSelect(key)
      setPasteKey('')
    }
  }

  const handleClear = () => {
    onSelect('', undefined)
    setSearchQuery('')
    setPasteKey('')
    setResults([])
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold font-body">Find Recipient</h3>

        {selectedKey ? (
          <div className="flex items-center justify-between bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
            <div>
              <span className="font-medium">
                {selectedName || 'Recipient'}
              </span>
              <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 ml-2">
                ({truncateKey(selectedKey)})
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or identifier"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching} variant="outline">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((r) => (
                  <button
                    key={r.publicKey}
                    className="w-full text-left p-3 rounded-lg border dark:border-slate-800/60 border-slate-200 hover:border-violet-500/30 dark:hover:bg-slate-800/40 hover:bg-violet-50 hover:shadow-violet-sm transition-all duration-200"
                    onClick={() => onSelect(r.publicKey, r.name)}
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.role && (
                      <span className="text-xs text-violet-500/50 dark:text-violet-400/50 ml-1.5">{r.role}</span>
                    )}
                    <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 block">
                      {truncateKey(r.publicKey)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex-1 h-px dark:bg-slate-800 bg-slate-200" />
              OR
              <div className="flex-1 h-px dark:bg-slate-800 bg-slate-200" />
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Paste recipient's public key"
                value={pasteKey}
                onChange={(e) => setPasteKey(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                onClick={handlePaste}
                disabled={!isValidPublicKey(pasteKey.trim())}
                variant="outline"
              >
                Use Key
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
