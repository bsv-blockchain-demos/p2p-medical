import { useState } from 'react'
import { useWallet } from '@/context/WalletContext'
import AppHeader from '@/components/app/AppHeader'
import PatientDashboard from '@/components/app/PatientDashboard'
import DoctorInbox from '@/components/app/DoctorInbox'
import AuditTimeline from '@/components/app/AuditTimeline'

export type Tab = 'upload' | 'inbox' | 'audit'

export default function MainApp() {
  const { role } = useWallet()
  const [tab, setTab] = useState<Tab>(role === 'doctor' ? 'inbox' : 'upload')

  return (
    <div className="min-h-screen bg-background bg-grid">
      <AppHeader activeTab={tab} onTabChange={setTab} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === 'upload' && <PatientDashboard />}
        {tab === 'inbox' && <DoctorInbox />}
        {tab === 'audit' && <AuditTimeline />}
      </main>
    </div>
  )
}
