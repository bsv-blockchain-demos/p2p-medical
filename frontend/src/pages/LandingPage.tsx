import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@/context/WalletContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Lock,
  Shield,
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
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.8 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.15 } },
}

const problems = [
  { icon: Database, label: 'Centralized databases', detail: 'Single points of failure' },
  { icon: AlertTriangle, label: 'Data breaches', detail: '700+ healthcare breaches in 2024' },
  { icon: UserX, label: 'No patient control', detail: 'Others decide who sees your data' },
  { icon: Eye, label: 'No audit trail', detail: 'Invisible access, zero accountability' },
  { icon: FileWarning, label: 'Third-party access', detail: 'Insurers, vendors, advertisers' },
]

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Encrypt & Upload',
    desc: 'Select a medical image, choose a recipient, and encrypt it end-to-end with their public key. Only they can read it.',
  },
  {
    icon: Send,
    step: '02',
    title: 'Peer-to-Peer Transfer',
    desc: 'The encrypted file is stored via UHRP and a blockchain token is minted as immutable proof of the transfer.',
  },
  {
    icon: FileKey,
    step: '03',
    title: 'Decrypt & View',
    desc: 'Only the intended recipient can decrypt and view the image. Access creates a permanent on-chain receipt.',
  },
]

const features = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    desc: 'AES-256-GCM encryption happens in your browser. No server, no middleman, ever sees plaintext data.',
    iconColor: 'text-violet-400',
  },
  {
    icon: Shield,
    title: 'Blockchain Audit Trail',
    desc: 'Every share and access is recorded on-chain. Immutable, timestamped, and permanently verifiable.',
    iconColor: 'text-violet-400',
  },
  {
    icon: User,
    title: 'Patient Controlled',
    desc: 'You hold the keys. You choose who sees your data. No corporate gatekeeper in between.',
    iconColor: 'text-violet-400',
  },
  {
    icon: HardDrive,
    title: 'UHRP Storage',
    desc: 'Content-addressed storage guarantees file integrity. If the hash matches, the file is authentic.',
    iconColor: 'text-violet-400',
  },
  {
    icon: Users,
    title: 'True Peer-to-Peer',
    desc: 'No central server processes or stores your medical images. Direct, encrypted, peer-to-peer.',
    iconColor: 'text-violet-400',
  },
]

export default function LandingPage() {
  const { connect, connecting, connected } = useWallet()
  const navigate = useNavigate()

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
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight font-display">P2P Med</span>
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
        {/* Background decoration */}
        <div className="absolute inset-0 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 bg-gradient-to-br from-white via-white to-slate-50" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-500/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="absolute inset-0 bg-grid" />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
          <motion.div
            className="inline-flex items-center gap-2 bg-violet-500/5 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8"
            variants={fadeUp}
          >
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-violet-500 dark:text-violet-400">Powered by BSV Blockchain</span>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-7xl font-display tracking-tight dark:text-white text-slate-900 leading-[1.1]"
            variants={fadeUp}
          >
            Secure Medical
            <br />
            Image Sharing
          </motion.h1>

          <motion.p
            className="mt-8 text-xl dark:text-slate-400 text-slate-500 max-w-xl mx-auto leading-relaxed font-body"
            variants={fadeUp}
          >
            Patient-controlled, end-to-end encrypted, with an immutable audit trail. Your data, your rules.
          </motion.p>

          <motion.div className="mt-12 flex items-center justify-center gap-4" variants={fadeUp}>
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

          {/* Trust indicators */}
          <motion.div
            className="mt-16 flex items-center justify-center gap-8 text-sm dark:text-slate-500 text-slate-400"
            variants={fadeIn}
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>AES-256-GCM</span>
            </div>
            <div className="w-1 h-1 dark:bg-slate-700 bg-slate-300 rounded-full" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>On-chain audit</span>
            </div>
            <div className="w-1 h-1 dark:bg-slate-700 bg-slate-300 rounded-full" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Zero intermediaries</span>
            </div>
          </motion.div>
        </div>
      </motion.section>

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
            <motion.p className="text-violet-500 dark:text-violet-400 font-semibold text-sm tracking-widest uppercase mb-3 font-body" variants={fadeUp}>
              The Problem
            </motion.p>
            <motion.h2 className="text-3xl sm:text-4xl font-display mb-4" variants={fadeUp}>
              Healthcare data is broken
            </motion.h2>
            <motion.p className="dark:text-slate-400 text-slate-500 max-w-lg mb-12 text-lg font-body" variants={fadeUp}>
              Patients have no control, no visibility, and no say in who accesses their most sensitive information.
            </motion.p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {problems.map(({ icon: Icon, label, detail }) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  className="group dark:bg-slate-900/60 bg-white/80 backdrop-blur-sm border dark:border-slate-800/60 border-slate-200/60 rounded-2xl p-5 hover:border-violet-500/20 hover:shadow-violet-sm transition-all duration-300"
                >
                  <Icon className="w-6 h-6 text-rose-400 mb-3 group-hover:text-rose-300 transition-colors" />
                  <p className="font-semibold text-sm mb-1 font-body">{label}</p>
                  <p className="text-xs dark:text-slate-500 text-slate-400 font-body">{detail}</p>
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
              <p className="text-violet-500 dark:text-violet-400 font-semibold text-sm tracking-widest uppercase mb-3 font-body">
                How It Works
              </p>
              <h2 className="text-3xl sm:text-4xl font-display">Three simple steps</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map(({ icon: Icon, step, title, desc }, i) => (
                <motion.div key={step} variants={fadeUp} className="relative">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-12 -right-4 z-10">
                      <ArrowRight className="w-8 h-8 dark:text-slate-800 text-slate-300" />
                    </div>
                  )}
                  <div className="glass rounded-2xl p-8 h-full hover:border-violet-500/20 hover:shadow-violet-sm hover:-translate-y-1 transition-all duration-300">
                    <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mb-6">
                      <Icon className="w-7 h-7 text-violet-400" />
                    </div>
                    <div className="text-xs font-bold text-violet-500/60 mb-2 font-body">STEP {step}</div>
                    <h3 className="text-xl font-display mb-3">{title}</h3>
                    <p className="dark:text-slate-400 text-slate-500 leading-relaxed font-body">{desc}</p>
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
              <p className="text-violet-500 dark:text-violet-400 font-semibold text-sm tracking-widest uppercase mb-3 font-body">
                Features
              </p>
              <h2 className="text-3xl sm:text-4xl font-display">Built for privacy, by design</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map(({ icon: Icon, title, desc, iconColor }) => (
                <motion.div key={title} variants={fadeUp}>
                  <div className="glass rounded-2xl p-8 h-full hover:border-violet-500/20 hover:shadow-violet-sm hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
                      <Icon className={`w-6 h-6 ${iconColor}`} />
                    </div>
                    <h3 className="text-lg font-display mb-2">{title}</h3>
                    <p className="dark:text-slate-400 text-slate-500 leading-relaxed text-sm font-body">{desc}</p>
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
              <motion.h2 className="text-3xl sm:text-4xl font-display mb-4" variants={fadeUp}>
                Take control of your medical data
              </motion.h2>
              <motion.p className="dark:text-slate-400 text-slate-500 text-lg mb-10 max-w-lg mx-auto font-body" variants={fadeUp}>
                Connect your BSV wallet to start sharing medical images securely, privately, and on your terms.
              </motion.p>
              <motion.div variants={fadeUp}>
                <Button
                  size="lg"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="text-base px-8 h-12 shadow-violet-lg"
                >
                  {connecting ? 'Connecting...' : 'Get Started'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Badges */}
      <section className="py-16 border-t dark:border-slate-800/50 border-slate-200 dark:bg-slate-950 bg-white">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold dark:text-slate-500 text-slate-400 tracking-widest uppercase mb-6 font-body">Built With</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['BSV SDK', 'Message Box', 'UHRP', 'Overlay Network', 'BRC-100 Wallet', 'PushDrop Tokens'].map(
              (tech) => (
                <Badge
                  key={tech}
                  variant="outline"
                  className="text-sm px-4 py-2 font-medium dark:text-slate-400 text-slate-500 dark:border-slate-700 border-slate-300 dark:bg-slate-900/50 bg-slate-50"
                >
                  {tech}
                </Badge>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-slate-800/50 border-slate-200 py-8 dark:bg-slate-950 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm dark:text-slate-500 text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-md flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span>P2P Med</span>
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
