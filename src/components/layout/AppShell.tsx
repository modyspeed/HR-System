import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { pageTransition } from '@/lib/motion'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandSearch } from './CommandSearch'

export function AppShell() {
  const location = useLocation()

  return (
    <div className="flex h-screen w-screen gap-6 overflow-hidden p-6">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Topbar />
        <main className="scroll-area flex-1 overflow-y-auto rounded-[32px]">
          <div className="mx-auto w-full max-w-7xl px-2 py-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageTransition}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <CommandSearch />
    </div>
  )
}
