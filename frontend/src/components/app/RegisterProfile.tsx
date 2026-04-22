import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileLock, User, Stethoscope, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWallet, type Role } from '@/context/WalletContext'
import { truncateKey } from '@/lib/utils'
import { ease } from '@/lib/motion'

export default function RegisterProfile() {
  const { identityKey, register, registering, error } = useWallet()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('patient')
  const [localError, setLocalError] = useState<string | null>(null)

  const canSubmit = name.trim().length >= 2 && !registering

  const handleRegister = async () => {
    setLocalError(null)
    try {
      await register(name.trim(), role)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  const displayError = localError || error

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-grid-atmospheric pointer-events-none" />
      <div className="fixed top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-violet-500/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

      <motion.div
        className="w-full max-w-md relative"
        initial={{ opacity: 0, y: 20, scale: 0.97, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="dark:bg-slate-900/60 bg-white/80 backdrop-blur-xl border dark:border-slate-800/60 border-slate-200/60 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-violet-sm">
              <FileLock className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold">Create Your Profile</h1>
            <p className="text-sm dark:text-slate-400 text-slate-500 text-center">
              Register your identity on the BSV blockchain to start sharing medical data securely.
            </p>
          </div>

          {/* Identity Key */}
          {identityKey && (
            <div className="mb-6 text-center">
              <span className="text-xs font-mono text-violet-500 dark:text-violet-400/70 bg-violet-500/5 border border-violet-500/10 px-3 py-1.5 rounded-lg">
                {truncateKey(identityKey)}
              </span>
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium dark:text-slate-300 text-slate-600">Display Name</label>
            <Input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleRegister()}
            />
          </div>

          {/* Role Selection */}
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium dark:text-slate-300 text-slate-600">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setRole('patient')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors duration-200 ${
                  role === 'patient'
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-500 dark:text-violet-400'
                    : 'dark:border-slate-800/60 border-slate-200 dark:bg-slate-800/20 bg-slate-50 dark:text-slate-400 text-slate-500 dark:hover:border-slate-700 hover:border-slate-300 dark:hover:bg-slate-800/40 hover:bg-slate-100'
                }`}
                animate={
                  role === 'patient'
                    ? { boxShadow: '0 0 15px rgba(139, 92, 246, 0.15)' }
                    : { boxShadow: '0 0 0px rgba(139, 92, 246, 0)' }
                }
                transition={{ duration: 0.3 }}
              >
                <User className="w-6 h-6" />
                <span className="text-sm font-medium">Patient</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setRole('doctor')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors duration-200 ${
                  role === 'doctor'
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-500 dark:text-violet-400'
                    : 'dark:border-slate-800/60 border-slate-200 dark:bg-slate-800/20 bg-slate-50 dark:text-slate-400 text-slate-500 dark:hover:border-slate-700 hover:border-slate-300 dark:hover:bg-slate-800/40 hover:bg-slate-100'
                }`}
                animate={
                  role === 'doctor'
                    ? { boxShadow: '0 0 15px rgba(139, 92, 246, 0.15)' }
                    : { boxShadow: '0 0 0px rgba(139, 92, 246, 0)' }
                }
                transition={{ duration: 0.3 }}
              >
                <Stethoscope className="w-6 h-6" />
                <span className="text-sm font-medium">Doctor</span>
              </motion.button>
            </div>
          </div>

          {/* Error */}
          {displayError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {displayError}
            </div>
          )}

          {/* Register Button */}
          <Button
            onClick={handleRegister}
            disabled={!canSubmit}
            className="w-full"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              'Register on Blockchain'
            )}
          </Button>

          {/* Disclaimer */}
          <p className="mt-4 text-xs dark:text-slate-500 text-slate-400 text-center">
            Your name and role will be publicly discoverable so other users can find you.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
