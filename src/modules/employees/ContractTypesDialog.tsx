import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface ContractTypesDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * كتالوج أنواع التعاقد (دائم، مؤقت، موسمي…): قائمة مرجعية تُدار بالكامل
 * (إضافة/تعديل/حذف) ويختار منها نموذج الموظف. حذف نوع يحرر الروابط فقط —
 * أسماء الموظفين الحالية تبقى محفوظة لديهم كسجل تاريخي.
 */
export function ContractTypesDialog({ open, onClose }: ContractTypesDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const typesQuery = useQuery({
    queryKey: ['employees', 'contractTypes'],
    queryFn: () => api.employees.contractTypeList(),
    enabled: open
  })
  const types = typesQuery.data ?? []

  useEffect(() => {
    if (!open) {
      setNewName('')
      setEditingId(null)
      setConfirmDelete(null)
    }
  }, [open])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees', 'contractTypes'] })
  }

  const createMutation = useMutation({
    mutationFn: () => api.employees.contractTypeCreate({ name: newName }),
    onSuccess: () => {
      toast.success(t('toasts.contractTypeCreated'))
      setNewName('')
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const updateMutation = useMutation({
    mutationFn: () => api.employees.contractTypeUpdate(editingId!, { name: editingName }),
    onSuccess: () => {
      toast.success(t('toasts.contractTypeUpdated'))
      setEditingId(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.employees.contractTypeRemove(confirmDelete!),
    onSuccess: () => {
      toast.success(t('toasts.contractTypeDeleted'))
      setConfirmDelete(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('employees.contractTypesTitle')}
        description={t('employees.contractTypesHint')}
        size="md"
        footer={
          <SoftButton variant="subtle" onClick={onClose}>
            {t('common.close')}
          </SoftButton>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          {/* إضافة */}
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newName.trim()) createMutation.mutate()
              }}
              placeholder={t('employees.contractTypeNamePlaceholder')}
              dir="auto"
              className="field h-11 flex-1 rounded-xl px-4 text-sm text-ink-high placeholder:text-ink-low outline-none"
            />
            <SoftButton
              variant="primary"
              icon={<Plus className="size-4" />}
              loading={createMutation.isPending}
              disabled={!newName.trim()}
              onClick={() => createMutation.mutate()}
            >
              {t('employees.contractTypeAdd')}
            </SoftButton>
          </div>

          {/* القائمة */}
          <div className="scroll-area max-h-[46vh] overflow-auto rounded-2xl border border-line">
            <ul className="divide-y divide-surface-base">
              {types.map((type) => {
                const editing = editingId === type.id
                return (
                  <li key={type.id} className="flex items-center gap-3 px-4 py-2.5">
                    {editing ? (
                      <>
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && editingName.trim()) updateMutation.mutate()
                            if (event.key === 'Escape') setEditingId(null)
                          }}
                          dir="auto"
                          autoFocus
                          className="field h-10 flex-1 rounded-lg px-3 text-sm text-ink-high outline-none"
                        />
                        <button
                          type="button"
                          title={t('common.save')}
                          onClick={() => updateMutation.mutate()}
                          className="focus-ring grid size-9 place-items-center rounded-lg text-teal-400 transition-colors hover:bg-surface-strong"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          title={t('common.cancel')}
                          onClick={() => setEditingId(null)}
                          className="focus-ring grid size-9 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong"
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p dir="auto" className="truncate text-sm font-medium text-ink-high">
                            {type.name}
                          </p>
                          <p className="text-[11px] text-ink-low">
                            {t('employees.contractTypeUsed', { count: type.employeesCount })}
                          </p>
                        </div>
                        <button
                          type="button"
                          title={t('common.edit')}
                          onClick={() => {
                            setEditingId(type.id)
                            setEditingName(type.name)
                          }}
                          className="focus-ring grid size-9 place-items-center rounded-lg text-ink-low transition-colors hover:bg-surface-strong hover:text-accent-300"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          title={t('common.delete')}
                          onClick={() => setConfirmDelete(type.id)}
                          className="focus-ring grid size-9 place-items-center rounded-lg text-ink-low transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
              {types.length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-ink-low">{t('employees.contractTypesEmpty')}</li>
              )}
            </ul>
          </div>

          <p className="rounded-2xl border border-line bg-surface-soft px-4 py-3 text-[11px] leading-relaxed text-ink-low">
            {t('employees.contractTypesNote')}
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        loading={deleteMutation.isPending}
        title={t('employees.contractTypesDeleteTitle')}
        body={
          confirmDelete
            ? t('employees.contractTypesDeleteBody', {
                name: types.find((type) => type.id === confirmDelete)?.name ?? ''
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}