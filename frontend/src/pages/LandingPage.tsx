import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@/context/WalletContext'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Lock,
  Shield,
  FileLock,
  User,
  HardDrive,
  Users,
  ArrowRight,
  Upload,
  Send,
  FileKey,
  AlertTriangle,
  Database,
  Eye,
  FileWarning,
  UserX,
  Wallet,
  Layers,
  Hash,
  Globe,
  MessageSquare,
  X,
} from 'lucide-react'

const customEase = [0.22, 1, 0.36, 1] as const

const fadeUp = {
  initial: { opacity: 0, y: 30, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.6, ease: customEase },
}

const fadeIn = {
  initial: { opacity: 0, filter: 'blur(4px)' },
  animate: { opacity: 1, filter: 'blur(0px)' },
  transition: { duration: 0.8, ease: customEase },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.15 } },
}

const cardReveal = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 20,
    },
  },
}

const problems = [
  { icon: Database, label: 'Stored on corporate servers', detail: 'One breach exposes millions of patient records' },
  { icon: AlertTriangle, label: 'Breaches are routine', detail: '725+ healthcare data breaches in 2023 alone' },
  { icon: UserX, label: 'Accessed without your consent', detail: 'Staff, vendors, and insurers view records freely' },
  { icon: Eye, label: 'No visibility for patients', detail: 'You have no way to know who viewed your files' },
  { icon: FileWarning, label: 'Sold without your knowledge', detail: 'Records shared with insurers, brokers, and ad networks' },
]

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Pick a file, pick your doctor',
    desc: 'Select a medical file and choose the doctor you want to share it with. The file is encrypted right in your browser — it never leaves your device unprotected.',
  },
  {
    icon: Send,
    step: '02',
    title: 'Permanent proof it was shared',
    desc: 'The encrypted file is stored securely, and a blockchain transaction creates a permanent, tamper-proof record of who shared what, with whom, and when.',
  },
  {
    icon: FileKey,
    step: '03',
    title: 'Doctor verifies and views',
    desc: "Your doctor's wallet verifies the file hasn't been altered, decrypts it, and records an on-chain attestation — proof the file was received and viewed.",
  },
]

const features = [
  {
    icon: Lock,
    title: 'Encrypted before it leaves your device',
    desc: 'Your files are encrypted with AES-256 inside your browser. No server, no cloud, no middleman ever touches the plaintext.',
    iconColor: 'text-violet-400',
  },
  {
    icon: Shield,
    title: 'Every access is permanently recorded',
    desc: "Every share and every view creates a blockchain record. Once written, it can't be edited, deleted, or denied — by anyone.",
    iconColor: 'text-violet-400',
  },
  {
    icon: User,
    title: 'You hold the only key',
    desc: "Your wallet is your identity and your access control. If you don't share a file, nobody sees it. No admin panel, no corporate override.",
    iconColor: 'text-violet-400',
  },
  {
    icon: HardDrive,
    title: 'Tamper-proof from send to receive',
    desc: "Files are stored by their cryptographic hash. If a single bit changes, the mismatch is caught — guaranteeing your doctor receives exactly what you sent.",
    iconColor: 'text-violet-400',
  },
  {
    icon: Users,
    title: 'Straight to your doctor, no detours',
    desc: 'Medical files go directly from you to your doctor. No intermediary processes, stores, or even sees the data. The blockchain records proof, not content.',
    iconColor: 'text-violet-400',
  },
  {
    icon: FileKey,
    title: 'Verified before it\'s opened',
    desc: "Every file is checked against its SHA-256 hash before decryption. If anything was altered in transit, it's caught instantly.",
    iconColor: 'text-violet-400',
  },
]

const techStack = [
  {
    icon: Globe,
    label: '@bsv/sdk',
    desc: 'Core SDK',
    title: 'The Foundation',
    body: 'The BSV SDK is the core toolkit that powers every interaction in the platform. It handles secure identity, digital signatures, and blockchain transactions behind the scenes — so when you share a file, verify a document, or check an audit trail, the heavy lifting is already done. Think of it as the engine under the hood that makes everything work seamlessly.',
  },
  {
    icon: Wallet,
    label: 'BRC-100',
    desc: 'Wallet Standard',
    title: 'Your Digital Identity',
    body: 'BRC-100 is the wallet standard that gives every user a secure digital identity. Instead of usernames and passwords, your wallet is your login — it proves who you are without exposing personal information. Only you hold the keys, so only you can authorize actions like sharing files or viewing records. No IT department or admin can override your access.',
  },
  {
    icon: MessageSquare,
    label: 'MessageBox',
    desc: 'Notifications',
    title: 'Instant Notifications',
    body: 'MessageBox is the secure notification system that alerts your doctor the moment you share a file. Instead of email (which can be intercepted) or SMS (which is unencrypted), notifications are delivered directly to your doctor\'s wallet. Only the intended recipient can read them, and they arrive in real time — so your doctor knows immediately when something needs attention.',
  },
  {
    icon: Lock,
    label: 'E2E Encryption',
    desc: 'ECDH + AES-256',
    title: 'End-to-End Encryption',
    body: 'When you share a file, your wallet and your doctor\'s wallet automatically negotiate a private shared key using ECDH (Elliptic Curve Diffie-Hellman) — no passwords, no key servers, no human involvement. That shared key then encrypts your file with AES-256-GCM, the same standard used by banks and governments. The result: your file is sealed on your device and can only be opened by your doctor\'s device. Not even the platform can read it.',
  },
  {
    icon: Layers,
    label: 'PushDrop',
    desc: 'Token Protocol',
    title: 'Tamper-Proof Records',
    body: 'Every time a file is shared, a digital token is created on the blockchain — like a notarized receipt that can never be altered. This token records exactly what was shared, by whom, to whom, and when. It\'s permanent, tamper-proof evidence that the exchange happened. If there\'s ever a dispute, the record speaks for itself.',
  },
  {
    icon: HardDrive,
    label: 'UHRP',
    desc: 'Content Storage',
    title: 'Secure File Hosting',
    body: 'UHRP (Universal Hash Resolution Protocol) is how encrypted files are stored and retrieved. Files are identified by their unique fingerprint — not a file name or location. This means if a file is tampered with, the fingerprint won\'t match and the system catches it automatically. Your files can be hosted across multiple providers for redundancy, without any of them being able to read the contents.',
  },
  {
    icon: Database,
    label: 'Overlay',
    desc: 'Network Layer',
    title: 'The Delivery Network',
    body: 'The Overlay Network is the communication layer that routes tokens and notifications between patients and doctors. It keeps track of which files are pending, which have been viewed, and maintains the real-time inbox experience. Think of it as the postal system — it delivers the sealed envelope without ever opening it.',
  },
  {
    icon: Hash,
    label: 'SHA-256',
    desc: 'Verification',
    title: 'Integrity Guarantee',
    body: 'SHA-256 is a mathematical fingerprinting technique. Before a file leaves your device, its unique fingerprint is calculated and permanently recorded. When your doctor downloads the file, the fingerprint is recalculated and compared. If even a single byte was changed in transit — by anyone, for any reason — the mismatch is caught instantly. This guarantees your doctor sees exactly what you sent.',
  },
] as const

export default function LandingPage() {
  const { connect, connecting, connected } = useWallet()
  const navigate = useNavigate()
  const [activeTech, setActiveTech] = useState<number | null>(null)

  async function handleConnect() {
    if (connected) {
      navigate('/app')
      return
    }
    const ok = await connect()
    if (ok) navigate('/app')
  }

  return (
    <div className="min-h-screen dark:bg-slate-950 bg-white">
      {/* Header */}
      <header className="border-b dark:border-slate-800/50 border-slate-200 dark:bg-slate-950/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-violet-md">
              <FileLock className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">P2P Medical</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : connected ? 'Open App' : 'Connect Wallet'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        className="relative overflow-hidden"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        {/* Background stack */}
        <div className="absolute inset-0 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 bg-gradient-to-br from-white via-white to-slate-50" />

        {/* Animated orbs */}
        <motion.div
          className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-60 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }}
          animate={{
            y: [0, 15, 0],
            x: [0, -8, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[30%] left-[40%] w-[350px] h-[350px] rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)' }}
          animate={{
            y: [0, -12, 0],
            x: [0, 12, 0],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Grid + noise */}
        <div className="absolute inset-0 bg-grid-atmospheric" />
        <div className="absolute inset-0 noise" />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
          <motion.div
            className="shimmer inline-flex items-center gap-2 bg-violet-500/5 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8"
            variants={fadeUp}
          >
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-violet-500 dark:text-violet-400">Built on BSV Blockchain</span>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.1]"
            variants={fadeUp}
          >
            <span className="text-gradient-hero">Every Access Recorded.</span>
            <br />
            <span className="dark:text-white text-slate-900">Every File Protected.</span>
          </motion.h1>

          <motion.p
            className="mt-8 text-xl dark:text-slate-400 text-slate-500 max-w-xl mx-auto leading-relaxed"
            variants={fadeUp}
          >
            Share medical files directly with your doctor. Every view is permanently logged on the blockchain — tamper-proof and transparent.
          </motion.p>

          <motion.div className="mt-12 flex items-center justify-center gap-4" variants={fadeUp}>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={connecting}
                className="text-base px-8 h-12 shadow-violet-lg"
              >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            className="mt-16 flex items-center justify-center gap-8 text-sm dark:text-slate-500 text-slate-400"
            variants={fadeIn}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Immutable audit trail</span>
            </div>
            <div className="w-1 h-1 dark:bg-slate-700 bg-slate-300 rounded-full" />
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>End-to-end encrypted</span>
            </div>
            <div className="w-1 h-1 dark:bg-slate-700 bg-slate-300 rounded-full" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Zero middlemen</span>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Tech Stack */}
      <section className="py-20 dark:bg-slate-950 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center"
          >
            <motion.p className="text-sm font-semibold dark:text-slate-500 text-slate-400 tracking-widest uppercase mb-2" variants={fadeUp}>
              Technology Stack
            </motion.p>
            <motion.h2 className="text-2xl sm:text-3xl font-semibold mb-12" variants={fadeUp}>
              Powered by BSV infrastructure
            </motion.h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {techStack.map(({ icon: Icon, label, desc }, i) => (
                <motion.button
                  key={label}
                  variants={cardReveal}
                  onClick={() => setActiveTech(i)}
                  className="group relative glass rounded-2xl p-5 hover:border-violet-500/30 hover:shadow-violet-sm hover:-translate-y-1 transition-all duration-300 cursor-pointer text-center"
                >
                  <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 group-hover:border-violet-500/30 transition-colors">
                    <Icon className="w-5 h-5 text-violet-400 group-hover:text-violet-300 transition-colors" />
                  </div>
                  <p className="font-semibold text-sm dark:text-slate-200 text-slate-700">{label}</p>
                  <p className="text-xs dark:text-slate-500 text-slate-400 mt-0.5">{desc}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Modal */}
      <AnimatePresence>
        {activeTech !== null && (() => {
          const tech = techStack[activeTech]
          const Icon = tech.icon
          return (
            <motion.div
              key="tech-modal-backdrop"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveTech(null)}
            >
              <div className="absolute inset-0 dark:bg-black/60 bg-black/40 backdrop-blur-sm" />
              <motion.div
                className="relative w-full max-w-lg dark:bg-slate-900 bg-white rounded-2xl border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.25, ease: customEase }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header gradient bar */}
                <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />

                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-violet-400" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold dark:text-white text-slate-900">{tech.label}</h3>
                        <p className="text-sm dark:text-slate-400 text-slate-500">{tech.title}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTech(null)}
                      className="w-8 h-8 rounded-lg dark:hover:bg-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                    </button>
                  </div>

                  <p className="dark:text-slate-300 text-slate-600 leading-relaxed">
                    {tech.body}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Problem Statement */}
      <section className="relative dark:bg-slate-950 bg-slate-50 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.p className="text-violet-500 dark:text-violet-400 font-semibold text-sm tracking-widest uppercase mb-3" variants={fadeUp}>
              The Problem
            </motion.p>
            <motion.h2 className="text-3xl sm:text-4xl font-semibold mb-4" variants={fadeUp}>
              Right now, you're not in control
            </motion.h2>
            <motion.p className="dark:text-slate-400 text-slate-500 max-w-lg mb-12 text-lg" variants={fadeUp}>
              Hospitals, insurers, and third parties access your medical records without asking. You never find out who looked, when, or why.
            </motion.p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {problems.map(({ icon: Icon, label, detail }) => (
                <motion.div
                  key={label}
                  variants={cardReveal}
                  className="group dark:bg-slate-900/60 bg-white/80 backdrop-blur-sm border dark:border-slate-800/60 border-slate-200/60 rounded-2xl p-5 hover:border-violet-500/20 hover:shadow-violet-sm hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Icon className="w-6 h-6 text-rose-400 mb-3 group-hover:text-rose-300 transition-colors" />
                  <p className="font-semibold text-sm mb-1">{label}</p>
                  <p className="text-xs dark:text-slate-500 text-slate-400">{detail}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-28 dark:bg-slate-950 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div className="text-center mb-16" variants={fadeUp}>
              <p className="text-violet-500 dark:text-violet-400 font-semibold text-sm tracking-widest uppercase mb-3">
                How It Works
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold">How sharing should work</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map(({ icon: Icon, step, title, desc }, i) => (
                <motion.div key={step} variants={cardReveal} className="relative">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-12 -right-4 z-10">
                      <ArrowRight className="w-8 h-8 dark:text-slate-800 text-slate-300" />
                    </div>
                  )}
                  <div className="glass rounded-2xl p-8 h-full hover:border-violet-500/20 hover:shadow-violet-sm hover:-translate-y-1 transition-all duration-300">
                    <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mb-6">
                      <Icon className="w-7 h-7 text-violet-400" />
                    </div>
                    <div className="text-xs font-bold text-violet-500/60 mb-2">STEP {step}</div>
                    <h3 className="text-xl font-semibold mb-3">{title}</h3>
                    <p className="dark:text-slate-400 text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-28 dark:bg-slate-950 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div className="text-center mb-16" variants={fadeUp}>
              <p className="text-violet-500 dark:text-violet-400 font-semibold text-sm tracking-widest uppercase mb-3">
                Features
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold">Built so only you decide who sees your data</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map(({ icon: Icon, title, desc, iconColor }) => (
                <motion.div key={title} variants={cardReveal}>
                  <div className="glass rounded-2xl p-8 h-full hover:border-violet-500/20 hover:shadow-violet-sm hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
                      <Icon className={`w-6 h-6 ${iconColor}`} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{title}</h3>
                    <p className="dark:text-slate-400 text-slate-500 leading-relaxed text-sm">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 dark:bg-slate-950 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
            className="relative overflow-hidden bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/50 from-slate-50 via-white to-violet-50 rounded-3xl border dark:border-slate-800/60 border-slate-200/60 p-12 md:p-16 text-center"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.12),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.06),transparent_60%)]" />

            <div className="relative">
              <motion.h2 className="text-3xl sm:text-4xl font-semibold mb-4" variants={fadeUp}>
                Try it yourself
              </motion.h2>
              <motion.p className="dark:text-slate-400 text-slate-500 text-lg mb-10 max-w-lg mx-auto" variants={fadeUp}>
                Connect a wallet, share an encrypted medical file with a doctor, and see the full audit trail — all in under a minute.
              </motion.p>
              <motion.div variants={fadeUp}>
                <motion.div
                  className="inline-block"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="text-base px-8 h-12 shadow-violet-lg"
                  >
                    {connecting ? 'Connecting...' : 'Try the Demo'}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-slate-800/50 border-slate-200 py-8 dark:bg-slate-950 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm dark:text-slate-500 text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-md flex items-center justify-center">
              <FileLock className="w-3 h-3 text-white" />
            </div>
            <span>P2P Medical</span>
          </div>
          <a
            href="https://bsvblockchain.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-violet-400 transition-colors"
          >
            bsvblockchain.org
          </a>
        </div>
      </footer>
    </div>
  )
}
