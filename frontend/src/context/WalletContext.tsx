import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { WalletClient } from '@bsv/sdk'
import { connectWallet, getIdentityKey, disconnectWallet, hadPriorSession, tryReconnect } from '@/services/wallet'
import { fetchProfile, registerIdentity, deleteProfile, type UserProfile } from '@/services/identity'

export type Role = 'patient' | 'doctor'

interface WalletState {
  wallet: WalletClient | null
  identityKey: string | null
  connected: boolean
  connecting: boolean
  initializing: boolean
  registered: boolean
  registering: boolean
  profile: UserProfile | null
  role: Role
  connect: () => Promise<boolean>
  register: (name: string, role: Role) => Promise<void>
  resetProfile: () => Promise<void>
  disconnect: () => void
  error: string | null
}

const WalletContext = createContext<WalletState>({
  wallet: null,
  identityKey: null,
  connected: false,
  connecting: false,
  initializing: true,
  registered: false,
  registering: false,
  profile: null,
  role: 'patient',
  connect: async () => false,
  register: async () => {},
  resetProfile: async () => {},
  disconnect: () => {},
  error: null,
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [identityKey, setIdentityKey] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [registered, setRegistered] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
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

      // Check if already registered
      const existingProfile = await fetchProfile(key)
      if (existingProfile) {
        setProfile(existingProfile)
        setRegistered(true)
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      setConnected(false)
      return false
    } finally {
      setConnecting(false)
    }
  }, [])

  const register = useCallback(async (name: string, role: Role) => {
    if (!identityKey) throw new Error('Wallet not connected')
    setRegistering(true)
    setError(null)
    try {
      await registerIdentity(name, role)
      // Registration succeeded — set profile directly (no round-trip needed)
      setProfile({ name, role, identityKey })
      setRegistered(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setRegistering(false)
    }
  }, [identityKey])

  const resetProfile = useCallback(async () => {
    if (!identityKey) throw new Error('Wallet not connected')
    await deleteProfile(identityKey)
    setRegistered(false)
    setProfile(null)
    setError(null)
  }, [identityKey])

  const disconnect = useCallback(() => {
    disconnectWallet()
    setWallet(null)
    setIdentityKey(null)
    setConnected(false)
    setRegistered(false)
    setProfile(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!hadPriorSession()) {
      setInitializing(false)
      return
    }
    tryReconnect().then((ok) => {
      if (ok) {
        connect().finally(() => setInitializing(false))
      } else {
        setInitializing(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const role: Role = profile?.role || 'patient'

  return (
    <WalletContext.Provider
      value={{ wallet, identityKey, connected, connecting, initializing, registered, registering, profile, role, connect, register, resetProfile, disconnect, error }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
