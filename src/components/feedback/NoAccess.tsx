import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldX } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, spring } from '@/lib/motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { SoftButton } from '@/components/ui/SoftButton'

export function NoAccess() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="grid h-full place-items-center p-8">
      <motion.div variants={fadeUp} initial="initial" animate="animate" transition={spring}>
        <GlassCard className="w-full max-w-md p-10 text-center">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full border border-rose-400/25 bg-rose-500/10 text-rose-400">
            <ShieldX className="size-8" />
          </div>
          <h1 className="text-xl font-bold text-ink-high">{t('noAccess.title')}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-med">
            {t('noAccess.body')}
          </p>
          <div className="mt-7 flex justify-center">
            <SoftButton variant="primary" onClick={() => navigate('/')}>
              {t('noAccess.back')}
            </SoftButton>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
