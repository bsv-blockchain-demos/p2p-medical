import type { Variants } from 'framer-motion'

export const ease = [0.22, 1, 0.36, 1] as const

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
    filter: 'blur(4px)',
  },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease,
    },
  },
}

export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    filter: 'blur(4px)',
  },
  show: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease,
    },
  },
}

export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -4,
    scale: 0.98,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: {
      duration: 0.15,
    },
  },
}

export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 24,
  },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease,
    },
  },
}

export const successDetailRow: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
}

export const successStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

export const progressStep: Variants = {
  inactive: {
    opacity: 0.5,
    scale: 0.98,
  },
  active: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  complete: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
}
