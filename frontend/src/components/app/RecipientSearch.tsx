import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { searchIdentity, isValidPublicKey, type IdentityResult } from '@/services/identity'

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
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced typeahead search
  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await searchIdentity(query)
      setResults(found)
      setShowDropdown(true)
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (r: IdentityResult) => {
    onSelect(r.publicKey, r.name)
    setSearchQuery('')
    setResults([])
    setShowDropdown(false)
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
    setShowDropdown(false)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold">Find Recipient</h3>

        {selectedKey ? (
          <div className="flex items-center justify-between bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
            <div>
              <span className="font-medium">
                {selectedName || 'Recipient'}
              </span>
              <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 ml-2">
                <span className="break-all">({selectedKey})</span>
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  ref={inputRef}
                  placeholder="Search by name or identifier"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => results.length > 0 && setShowDropdown(true)}
                  className="pl-9 pr-9"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500 animate-spin" />
                )}
              </div>

              {showDropdown && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border dark:border-slate-800/60 border-slate-200 dark:bg-slate-900 bg-white shadow-lg overflow-hidden">
                  {results.map((r) => (
                    <button
                      key={r.publicKey}
                      className="w-full text-left px-3 py-2.5 hover:bg-violet-500/10 transition-colors border-b dark:border-slate-800/40 border-slate-100 last:border-0"
                      onClick={() => handleSelect(r)}
                    >
                      <span className="font-medium text-sm">{r.name}</span>
                      {r.role && (
                        <span className="text-xs text-violet-500/50 dark:text-violet-400/50 ml-1.5">{r.role}</span>
                      )}
                      <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 block">
                        {r.publicKey}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && searchQuery.trim().length >= 2 && !searching && results.length === 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border dark:border-slate-800/60 border-slate-200 dark:bg-slate-900 bg-white shadow-lg px-3 py-3 text-sm dark:text-slate-500 text-slate-400">
                  No results for "{searchQuery.trim()}"
                </div>
              )}
            </div>

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
