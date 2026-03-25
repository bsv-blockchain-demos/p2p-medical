import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { WalletClient } from '@bsv/sdk'
import { connectWallet, isWalletConnected, getIdentityKey } from '@/services/wallet'

export type Role = 'patient' | 'doctor'

interface WalletState {
  wallet: WalletClient | null
  identityKey: string | null
  connected: boolean
  connecting: boolean
  role: Role
  setRole: (role: Role) => void
  connect: () => Promise<void>
  error: string | null
}

const WalletContext = createContext<WalletState>({
  wallet: null,
  identityKey: null,
  connected: false,
  connecting: false,
  role: 'patient',
  setRole: () => {},
  connect: async () => {},
  error: null,
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [identityKey, setIdentityKey] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [role, setRole] = useState<Role>('patient')
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const w = await connectWallet()
      const key = await getIdentityKey()
      setWallet(w)
      setIdentityKey(key)
      setConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      setConnected(false)
    } finally {
      setConnecting(false)
    }
  }, [])

  useEffect(() => {
    isWalletConnected().then((ok) => {
      if (ok) connect()
    })
  }, [connect])

  return (
    <WalletContext.Provider
      value={{ wallet, identityKey, connected, connecting, role, setRole, connect, error }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
