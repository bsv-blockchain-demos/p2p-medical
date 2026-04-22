import { useState, useEffect, useCallback } from 'react'
import { FileLock, ShieldCheck, Inbox, Clock } from 'lucide-react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import ThemeToggle from '@/components/ThemeToggle'
import ProfileDropdown from '@/components/app/ProfileDropdown'
import { useWallet } from '@/context/WalletContext'
import { queryPendingTokens } from '@/services/tokens'

const tabs = [
  { to: '/app/share', label: 'Share', icon: ShieldCheck },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/audit', label: 'Audit', icon: Clock },
]

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { identityKey } = useWallet()
  const [inboxCount, setInboxCount] = useState(0)

  const refreshCount = useCallback(async () => {
    if (!identityKey) return
    try {
      const tokens = await queryPendingTokens(identityKey)
      setInboxCount(tokens.length)
    } catch {
      // ignore
    }
  }, [identityKey])

  useEffect(() => {
    refreshCount()
  }, [refreshCount, location.pathname])

  return (
    <header className="dark:bg-slate-950/80 bg-white/80 backdrop-blur-xl border-b dark:border-slate-800/50 border-slate-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-violet-sm">
              <FileLock className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:inline">P2P Medical</span>
          </button>

          <nav className="flex gap-1 flex-1">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-violet-500/10 text-violet-500 dark:text-violet-400'
                      : 'dark:text-slate-500 text-slate-400 dark:hover:text-slate-300 hover:text-slate-600 dark:hover:bg-slate-800/40 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {label === 'Inbox' && inboxCount > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center leading-none">
                    {inboxCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ProfileDropdown />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
