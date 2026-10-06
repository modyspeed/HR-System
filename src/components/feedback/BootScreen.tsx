import { motion } from 'framer-motion'

export function BootScreen() {
  return (
    <div className="grid h-screen w-screen place-items-center">
      <div className="flex flex-col items-center gap-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="grid size-16 place-items-center rounded-full bg-gradient-to-b from-accent-300 to-accent-500 shadow-[var(--shadow-cta),var(--shadow-rim)]"
        >
          <span className="font-serif text-2xl font-bold text-accent-ink">HR</span>
        </motion.div>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="size-1.5 rounded-full bg-accent-400"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.15,
                ease: 'easeInOut'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
