import { Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider, useWallet } from '@/context/WalletContext'
import LandingPage from '@/pages/LandingPage'
import MainApp from '@/pages/MainApp'
import RegisterProfile from '@/components/app/RegisterProfile'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { connected, registered } = useWallet()
  if (!connected) return <Navigate to="/" replace />
  if (!registered) return <RegisterProfile />
  return <>{children}</>
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
        />
      </Routes>
    </WalletProvider>
  )
}
