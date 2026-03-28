import { useState, useRef, useEffect } from 'react'
import { Copy, Check, RotateCcw, ChevronDown, Link, LogOut } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'

export default function ProfileDropdown() {
  const { identityKey, profile, resetProfile, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (!profile) return null

  const roleLabel = profile.role === 'doctor' ? 'Doctor' : 'Patient'

  async function copyKey() {
    if (!identityKey) return
    await navigator.clipboard.writeText(identityKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors dark:hover:bg-slate-800/60 hover:bg-slate-100"
      >
        <span className="dark:text-slate-200 text-slate-700">{profile.name}</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 dark:bg-slate-800/50 bg-slate-100">
          {roleLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 dark:text-slate-400 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white shadow-lg shadow-black/10 z-50">
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">Wallet Connected</span>
          </div>

          <div className="border-t dark:border-slate-800 border-slate-200" />

          <div className="p-3">
            <p className="text-xs font-medium dark:text-slate-400 text-slate-500 mb-1.5">Identity Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono dark:text-violet-400 text-violet-600 dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 px-2.5 py-1.5 rounded-lg break-all leading-relaxed">
                {identityKey}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 p-1.5 rounded-md dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
                title="Copy key"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          <div className="border-t dark:border-slate-800 border-slate-200" />

          <div className="p-1.5">
            <button
              onClick={async () => {
                if (window.confirm('Reset your profile? You can re-register with a different role.')) {
                  await resetProfile()
                  setOpen(false)
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-rose-500 dark:hover:bg-rose-500/10 hover:bg-rose-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Profile
            </button>
          </div>

          <div className="border-t dark:border-slate-800 border-slate-200" />

          <div className="p-1.5">
            <button
              onClick={() => {
                disconnect()
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm dark:text-slate-400 text-slate-500 dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
