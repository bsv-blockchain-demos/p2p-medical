import { Shield, Upload, Inbox, FileText, RotateCcw } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { truncateKey } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'
import type { Tab } from '@/pages/MainApp'

interface AppHeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: typeof Upload }[] = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'audit', label: 'Audit', icon: FileText },
]

export default function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { identityKey, profile, resetProfile } = useWallet()

  return (
    <header className="dark:bg-slate-950/80 bg-white/80 backdrop-blur-xl border-b dark:border-slate-800/50 border-slate-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-violet-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold font-display text-lg">P2P Medical</span>
          </div>

          <div className="flex items-center gap-3">
            {profile && (
              <>
                <span className="text-sm font-medium dark:text-slate-200 text-slate-700">{profile.name}</span>
                <Badge variant={profile.role === 'doctor' ? 'default' : 'secondary'}>
                  {profile.role}
                </Badge>
              </>
            )}

            {identityKey && (
              <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 bg-violet-500/5 border border-violet-500/10 px-2 py-1 rounded">
                {truncateKey(identityKey)}
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-400 hover:text-rose-400"
              onClick={async () => {
                if (window.confirm('Reset your profile? You can re-register with a different role.')) {
                  await resetProfile()
                }
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>

            <ThemeToggle />
          </div>
        </div>

        <nav className="flex gap-1 mt-3 -mb-px">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === id
                  ? 'bg-violet-500/10 text-violet-500 dark:text-violet-400'
                  : 'dark:text-slate-500 text-slate-400 dark:hover:text-slate-300 hover:text-slate-600 dark:hover:bg-slate-800/40 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
