import { Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider, useWallet } from '@/context/WalletContext'
import LandingPage from '@/pages/LandingPage'
import MainApp from '@/pages/MainApp'
import RegisterProfile from '@/components/app/RegisterProfile'
import PatientDashboard from '@/components/app/PatientDashboard'
import DoctorInbox from '@/components/app/DoctorInbox'
import AuditTimeline from '@/components/app/AuditTimeline'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { connected, registered } = useWallet()
  if (!connected) return <Navigate to="/" replace />
  if (!registered) return <RegisterProfile />
  return <>{children}</>
}

function DefaultRedirect() {
  const { role } = useWallet()
  return <Navigate to={role === 'doctor' ? '/app/inbox' : '/app/share'} replace />
}

export default function App() {
  return (
    <WalletProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          }
        >
          <Route index element={<DefaultRedirect />} />
          <Route path="share" element={<PatientDashboard />} />
          <Route path="inbox" element={<DoctorInbox />} />
          <Route path="audit" element={<AuditTimeline />} />
        </Route>
      </Routes>
    </WalletProvider>
  )
}
