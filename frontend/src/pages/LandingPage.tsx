import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@/context/WalletContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

export default function LandingPage() {
  const { connect, connecting, connected } = useWallet()
  const navigate = useNavigate()

  async function handleConnect() {
    if (connected) {
      navigate('/app')
      return
    }
    await connect()
    navigate('/app')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">P2P Medical</span>
          </div>
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : connected ? 'Open App' : 'Connect Wallet'}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        className="max-w-6xl mx-auto px-6 py-24 text-center"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        <motion.h1
          className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl"
          variants={fadeUp}
        >
          Secure Medical Image Sharing
        </motion.h1>
        <motion.p
          className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto"
          variants={fadeUp}
        >
          Patient-controlled, end-to-end encrypted, powered by BSV blockchain.
        </motion.p>
        <motion.div className="mt-10" variants={fadeUp}>
          <Button size="lg" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Wallet'}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
      </motion.section>

      {/* Problem Statement */}
      <section className="bg-slate-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-bold mb-8">THE PROBLEM</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                'Centralized databases',
                'Data breaches',
                'No patient control',
                'No audit trail',
                'Third-party access',
              ].map((problem) => (
                <div
                  key={problem}
                  className="bg-slate-800 rounded-lg p-4 text-center text-sm font-medium"
                >
                  {problem}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 className="text-2xl font-bold mb-12 text-center" variants={fadeUp}>
              HOW IT WORKS
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: Upload,
                  step: 'STEP 1',
                  title: 'Patient encrypts & uploads',
                  desc: 'Select an image, choose your doctor, and encrypt it with their public key.',
                },
                {
                  icon: Send,
                  step: 'STEP 2',
                  title: 'Encrypted file sent peer-to-peer',
                  desc: 'File is stored via UHRP with a blockchain token as proof of sharing.',
                },
                {
                  icon: FileKey,
                  step: 'STEP 3',
                  title: 'Doctor decrypts & views',
                  desc: 'Only the intended doctor can decrypt. Access creates an immutable receipt.',
                },
              ].map(({ icon: Icon, step, title, desc }, i) => (
                <motion.div key={step} variants={fadeUp}>
                  <Card className="h-full text-center hover:shadow-lg transition-shadow">
                    <CardContent className="pt-8 pb-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-xs font-semibold text-primary mb-2">{step}</p>
                      <h3 className="font-semibold mb-2">{title}</h3>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                      {i < 2 && (
                        <ArrowRight className="w-5 h-5 text-muted-foreground mx-auto mt-4 hidden md:block" />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 className="text-2xl font-bold mb-12 text-center" variants={fadeUp}>
              KEY FEATURES
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Lock,
                  title: 'End-to-End Encryption',
                  desc: 'AES-256-GCM encryption in the browser. No server ever sees plaintext.',
                },
                {
                  icon: Shield,
                  title: 'Blockchain Audit Trail',
                  desc: 'Immutable on-chain access log. Know exactly who viewed your data and when.',
                },
                {
                  icon: User,
                  title: 'Patient Controlled',
                  desc: 'You decide who sees your medical images. Revoke access at any time.',
                },
                {
                  icon: HardDrive,
                  title: 'UHRP Storage',
                  desc: 'Content-addressed storage ensures file integrity and availability.',
                },
                {
                  icon: Users,
                  title: 'Peer-to-Peer',
                  desc: 'No central server sees your data. Direct patient-to-doctor sharing.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <motion.div key={title} variants={fadeUp}>
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <Icon className="w-8 h-8 text-primary mb-3" />
                      <h3 className="font-semibold mb-1">{title}</h3>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Badges */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-lg font-semibold mb-6 text-muted-foreground">BUILT WITH</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['BSV SDK', 'Message Box', 'UHRP', 'Overlay Network', 'BRC-100 Wallet', 'PushDrop Tokens'].map(
              (tech) => (
                <Badge key={tech} variant="secondary" className="text-sm px-4 py-1.5">
                  {tech}
                </Badge>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>Built on BSV Blockchain</span>
          <a
            href="https://bsvblockchain.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            bsvblockchain.org
          </a>
        </div>
      </footer>
    </div>
  )
}
