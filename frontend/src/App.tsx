import { Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider, useWallet } from '@/context/WalletContext'
import LandingPage from '@/pages/LandingPage'
import MainApp from '@/pages/MainApp'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet()
  if (!connected) return <Navigate to="/" replace />
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
