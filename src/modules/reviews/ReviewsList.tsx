import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ClipboardCheck, LayoutGrid } from 'lucide-react'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { PayrollItemsMatrix } from './PayrollItemsMatrix'

type ReviewSection = 'items'

const SECTIONS: { key: ReviewSection; labelKey: string; icon: typeof ClipboardCheck }[] = [
  { key: 'items', labelKey: 'reviews.items.tab', icon: LayoutGrid }
]

/**
 * المراجعة: شاشة تفتيش ومتابعة — تبدأ بمصفوفة مفردات المرتب والحافز
 * (صف لكل موظف وعمود لكل بند) وتتسع لبقية أقسام المراجعة لاحقًا.
 *
 * شريط الأقسام لا يظهر إلا عند وجود أكثر من قسم؛ فقسم واحد لا يحتاج اختيارًا.
 */
export function ReviewsList() {
  const { t } = useTranslation()
  const [section, setSection] = useState<ReviewSection>('items')
  const hasMultipleSections = SECTIONS.length > 1

  return (
    <div>
      <PageHeader
        title={t('reviews.title')}
        accent="Review"
        subtitle={t('reviews.subtitle')}
      />

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-5"
      >
        {hasMultipleSections && (
          <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-2">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              const active = item.key === section
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                    active
                      ? 'border-line-strong bg-surface-strong text-ink-high shadow-[var(--shadow-raised),var(--shadow-rim)]'
                      : 'border-line bg-surface-soft text-muted hover:text-ink-high'
                  )}
                >
                  <Icon className="size-4" />
                  {t(item.labelKey)}
                </button>
              )
            })}
          </motion.div>
        )}

        {section === 'items' && <PayrollItemsMatrix />}
      </motion.div>
    </div>
  )
}
