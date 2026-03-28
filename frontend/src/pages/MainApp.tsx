import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AppHeader from '@/components/app/AppHeader'
import { ease } from '@/lib/motion'

const pageVariants = {
  enter: {
    opacity: 0,
    y: 12,
    filter: 'blur(4px)',
  },
  center: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.35, ease },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
    transition: { duration: 0.2 },
  },
}

export default function MainApp() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background relative">
      {/* Atmospheric background */}
      <div className="fixed inset-0 bg-grid-atmospheric pointer-events-none" />
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-violet-500/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-500/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative">
        <AppHeader />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
