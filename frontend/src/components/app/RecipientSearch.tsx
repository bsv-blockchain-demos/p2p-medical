import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Loader2, Lock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { searchIdentity, isValidPublicKey, type IdentityResult } from '@/services/identity'
import { truncateKey } from '@/lib/utils'
import { dropdownVariants, ease } from '@/lib/motion'

interface RecipientSearchProps {
  onSelect: (key: string, name?: string) => void
  selectedKey: string | null
  selectedName: string | null
}

function AvatarCircle({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = (name || '?')[0].toUpperCase()
  const cls = size === 'sm'
    ? 'w-7 h-7 text-xs'
    : 'w-10 h-10 text-sm font-semibold'
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0`}>
      {initial}
    </div>
  )
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
        {/* Step header */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
            1
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Choose Recipient</h3>
              {selectedKey && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search for a registered doctor or paste their public key
            </p>
          </div>
        </div>

        {selectedKey ? (
          <>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex items-center justify-between bg-violet-500/5 border border-violet-500/20 rounded-lg p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AvatarCircle name={selectedName || 'R'} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedName || 'Recipient'}</span>
                    <Badge variant="secondary">Doctor</Badge>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground block truncate">
                    {truncateKey(selectedKey, 10)}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClear}>
                <X className="w-4 h-4" />
              </Button>
            </motion.div>

            {/* Inline trust signal */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span>File will be encrypted exclusively for this recipient</span>
            </div>
          </>
        ) : (
          <div className="flex gap-3">
            <div className="relative flex-1" ref={dropdownRef}>
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

              <AnimatePresence>
                {showDropdown && results.length > 0 && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="absolute z-50 w-full mt-1 rounded-lg border dark:border-slate-800/60 border-slate-200 dark:bg-slate-900 bg-white shadow-lg overflow-hidden"
                  >
                    {results.map((r, i) => (
                      <motion.button
                        key={r.publicKey}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2, ease }}
                        className="w-full text-left px-3 py-2.5 hover:bg-violet-500/10 transition-colors border-b dark:border-slate-800/40 border-slate-100 last:border-0 flex items-center gap-2.5"
                        onClick={() => handleSelect(r)}
                      >
                        <AvatarCircle name={r.name} size="sm" />
                        <div className="min-w-0">
                          <span className="font-medium text-sm">{r.name}</span>
                          {r.role && (
                            <span className="text-xs text-violet-500/50 dark:text-violet-400/50 ml-1.5">{r.role}</span>
                          )}
                          <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 block truncate">
                            {r.publicKey}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {showDropdown && searchQuery.trim().length >= 2 && !searching && results.length === 0 && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="absolute z-50 w-full mt-1 rounded-lg border dark:border-slate-800/60 border-slate-200 dark:bg-slate-900 bg-white shadow-lg px-3 py-3 text-sm dark:text-slate-500 text-slate-400"
                  >
                    No results for &ldquo;{searchQuery.trim()}&rdquo;
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <span className="self-center text-sm text-muted-foreground">OR</span>

            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Paste public key"
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
