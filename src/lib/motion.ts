import type { Transition, Variants } from 'framer-motion'

export const durations = {
  fast: 0.18,
  base: 0.26,
  slow: 0.4
} as const

export const spring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
  mass: 0.8
}

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 22,
  mass: 0.9
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 6 }
}

/** Staggered container for lists, tables and card grids. */
export const staggerContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.04 }
  }
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 }
}

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)' }
}
