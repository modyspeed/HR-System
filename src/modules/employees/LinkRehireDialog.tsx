import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link2, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { EmployeeRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { useDebounce } from '@/hooks/useDebounce'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SoftButton } from '@/components/ui/SoftButton'
import { useQuery } from '@tanstack/react-query'
import { employeeStatusTone } from './employeeStatusMeta'

interface LinkRehireDialogProps {
  open: boolean
  /** الموظف الجديد (المرشح للربط). */
  employee: EmployeeRecord | null
  onClose: () => void
  onLinked: () => void
}

/**
 * ربط موظف أُضيف كملف جديد بملفه الأصلي (معاش/استقالة…): يبحث في الملفات
 * السابقة، وعند الاختيار يُكمل الحقول الفارغة تلقائيًا ويظهر الربط في
 * الشارات — دون المساس بحالة الملف القديم وسجله (الظروف قبل المعاش).
 */
export function LinkRehireDialog({ open, employee, onClose, onLinked }: LinkRehireDialogProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const candidatesQuery = useQuery({
    queryKey: ['employees', 'linkCandidates', debouncedSearch],
    queryFn: () => api.employees.list({ search: debouncedSearch || undefined }),
    enabled: open,
    staleTime: 60_000
  })

  const candidates = useMemo(() => {
    if (!employee) return []
    const rows = candidatesQuery.data ?? []
    return rows.filter(
      (row) => row.id !== employee.id && (row.status !== 'active' || !row.isActive)
    )
  }, [candidatesQuery.data, employee])

  const linkMutation = useMutation({
    mutationFn: () => api.employees.linkRehire(employee!.id, selectedId!),
    onSuccess: () => {
      toast.success(t('toasts.employeeLinkedRehire'))
      onLinked()
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
      setSelectedId(null)
    }
  })

  const visible = candidates.slice(0, 12)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('employees.linkRehireTitle')}
      description={employee ? `${employee.code} · ${employee.name}` : undefined}
      size="md"
      footer={
        <>
          <SoftButton variant="subtle" onClick={onClose} disabled={linkMutation.isPending}>
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            icon={<Link2 className="size-4" />}
            loading={linkMutation.isPending}
            disabled={!selectedId}
            onClick={() => linkMutation.mutate()}
          >
            {t('employees.linkRehireConfirm')}
          </SoftButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('employees.linkRehireSearch')}
          icon={<Search className="size-4" />}
        />

        <div className="scroll-area max-h-[46vh] overflow-auto rounded-2xl border border-line">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-ink-low">
              {t('employees.linkRehireNoResults')}
            </p>
          ) : (
            <ul className="divide-y divide-surface-base">
              {visible.map((row) => {
                const selected = selectedId === row.id
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(selected ? null : row.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                        selected ? 'bg-accent-500/10' : 'hover:bg-surface-soft'
                      }`}
                    >
                      <span dir="ltr" className="font-mono text-xs text-ink-low">
                        {row.code}
                      </span>
                      <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium text-ink-high">
                        {row.name}
                      </span>
                      <Badge tone={employeeStatusTone(row.status)}>
                        {t(`employeeStatuses.${row.status}`)}
                      </Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="rounded-2xl border border-line bg-surface-soft px-4 py-3 text-[11px] leading-relaxed text-ink-low">
          {t('employees.linkRehireNote')}
        </p>
      </div>
    </Modal>
  )
}