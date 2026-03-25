import { Shield, Upload, Inbox, FileText } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { truncateKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { Tab } from '@/pages/MainApp'
import type { Role } from '@/context/WalletContext'

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
  const { identityKey, role, setRole } = useWallet()

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">P2P Medical</span>
          </div>

          <div className="flex items-center gap-4">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-32"
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </Select>

            {identityKey && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {truncateKey(identityKey)}
              </span>
            )}
          </div>
        </div>

        <nav className="flex gap-1 mt-3 -mb-px">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onTabChange(id)}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </nav>
      </div>
    </header>
  )
}
