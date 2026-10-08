import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, FileUp, Upload } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  EmployeeImportIssue,
  EmployeeImportRow,
  EmployeeParseResult
} from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { SoftButton } from '@/components/ui/SoftButton'

interface ImportEmployeesModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

const ACCEPTED = '.xlsx,.xls,.xlsm,.csv,.pdf'

export function ImportEmployeesModal({ open, onClose, onImported }: ImportEmployeesModalProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<EmployeeImportRow[]>([])
  const [issues, setIssues] = useState<EmployeeImportIssue[]>([])
  const [showIssues, setShowIssues] = useState(false)
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    setFileName(null)
    setRows([])
    setIssues([])
    setShowIssues(false)
  }

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const data = await file.arrayBuffer()
      return api.employees.parseImportFile({ data, fileName: file.name })
    },
    onSuccess: (result: EmployeeParseResult) => {
      setRows(result.rows)
      setIssues(result.issues)
      setShowIssues(result.issues.length > 0)
      if (result.rows.length === 0) {
        toast.error(t('employees.noRows'))
      }
    },
    onError: (error) => {
      toast.error(t('employees.importFailed'), { description: resolveApiError(error) })
    }
  })

  const importMutation = useMutation({
    mutationFn: (payload: EmployeeImportRow[]) => api.employees.importRows(payload),
    onSuccess: (summary) => {
      toast.success(
        t('employees.importSummary', {
          created: summary.created,
          updated: summary.updated,
          skipped: summary.skipped
        })
      )
      reset()
      onImported()
    },
    onError: (error) => {
      toast.error(t('toasts.error'), { description: resolveApiError(error) })
    }
  })

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setFileName(file.name)
    parseMutation.mutate(file)
  }

  const updateRow = (index: number, patch: Partial<EmployeeImportRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    )
  }

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  const validRowCount = rows.filter((row) => row.code.trim() && row.name.trim()).length
  const busy = parseMutation.isPending || importMutation.isPending

  const dateCell = (row: EmployeeImportRow, key: keyof EmployeeImportRow, index: number) => (
    <input
      type="date"
      dir="ltr"
      value={(row[key] as string | null) ?? ''}
      onChange={(event) => updateRow(index, { [key]: event.target.value || null } as Partial<EmployeeImportRow>)}
      className="field h-9 w-36 rounded-lg px-2 text-[11px] text-ink-high outline-none"
    />
  )

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={t('employees.importTitle')}
      description={t('employees.importHint')}
      size="xl"
      footer={
        <>
          <SoftButton
            variant="subtle"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={busy}
          >
            {t('common.cancel')}
          </SoftButton>
          <SoftButton
            variant="primary"
            loading={busy}
            icon={<Upload className="size-4" />}
            disabled={validRowCount === 0}
            onClick={() => importMutation.mutate(rows)}
          >
            {t('employees.importConfirm', { count: validRowCount })}
          </SoftButton>
        </>
      }
    >
      <div className="py-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFiles(event.dataTransfer.files)
          }}
          className={cn(
            'focus-ring flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-9 text-center transition-colors',
            dragging
              ? 'border-accent-400 bg-accent-500/10'
              : 'border-line-strong bg-surface-soft hover:border-accent-400/60'
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-surface-strong text-accent-300 shadow-[var(--shadow-raised),var(--shadow-rim)]">
            <FileUp className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-ink-high">
              {t('employees.dropOrClick')}
            </span>
            <span className="text-[11px] text-ink-low">{t('employees.formats')}</span>
          </span>
          {fileName && (
            <span className="rounded-full bg-surface-strong px-3 py-1 text-[11px] font-medium text-ink-med">
              {fileName}
            </span>
          )}
        </button>

        <AnimatePresence>
          {issues.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setShowIssues((value) => !value)}
                className="flex w-full items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"
              >
                <AlertTriangle className="size-3.5" />
                <span className="flex-1 text-start">
                  {t('employees.issuesCount', { count: issues.length })}
                </span>
                <span>{showIssues ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {showIssues && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="scroll-area mt-2 max-h-32 overflow-y-auto rounded-xl bg-surface-soft p-2"
                  >
                    {issues.map((issue, index) => (
                      <li key={index} className="flex items-center gap-3 px-2 py-1.5 text-[11px]">
                        <span className="shrink-0 font-mono text-ink-low">#{issue.line}</span>
                        <span className="flex-1 truncate text-ink-med" dir="auto">
                          {issue.raw || '—'}
                        </span>
                        <span className="shrink-0 text-amber-300/80">
                          {t(`employees.issue.${issue.reason}`)}
                        </span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {rows.length > 0 && (
          <div className="mt-5">
            <p className="mb-2.5 text-xs font-medium text-ink-med">
              {t('employees.previewHint')}
            </p>
            <div className="scroll-area max-h-[42vh] overflow-auto rounded-2xl border border-line">
              <table className="w-full min-w-[1500px]">
                <thead>
                  <tr className="border-b border-line bg-surface-soft text-[10px] uppercase tracking-wider text-ink-low">
                    <th className="px-3 py-2.5 text-start font-medium">#</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t('employees.code')}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t('employees.name')}</th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.insuranceNo')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.nationalId')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">{t('employees.grade')}</th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.qualification')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.qualificationYear')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.gradeDate')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.birthDate')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.permanentDate')}
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">
                      {t('employees.hireDate')}
                    </th>
                    <th className="px-3 py-2.5 text-end font-medium">{t('common.remove')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-base">
                  {rows.map((row, index) => {
                    const invalid = !row.code.trim() || !row.name.trim()
                    return (
                      <tr key={index} className={cn(invalid && 'bg-rose-500/[0.06]')}>
                        <td className="px-3 py-2 text-[11px] text-ink-low">{index + 1}</td>
                        <td className="px-2 py-2">
                          <input
                            value={row.code}
                            onChange={(event) => updateRow(index, { code: event.target.value })}
                            dir="ltr"
                            className={cn(
                              'field h-9 w-24 rounded-lg px-2.5 text-xs text-ink-high outline-none',
                              !row.code.trim() && 'field-invalid'
                            )}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.name}
                            onChange={(event) => updateRow(index, { name: event.target.value })}
                            dir="auto"
                            className={cn(
                              'field h-9 min-w-[200px] rounded-lg px-2.5 text-xs text-ink-high outline-none',
                              !row.name.trim() && 'field-invalid'
                            )}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.insuranceNo ?? ''}
                            onChange={(event) =>
                              updateRow(index, { insuranceNo: event.target.value || null })
                            }
                            dir="ltr"
                            className="field h-9 w-32 rounded-lg px-2.5 text-xs text-ink-high outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.nationalId ?? ''}
                            onChange={(event) =>
                              updateRow(index, { nationalId: event.target.value || null })
                            }
                            dir="ltr"
                            className="field h-9 w-40 rounded-lg px-2.5 text-xs text-ink-high outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.grade ?? ''}
                            onChange={(event) =>
                              updateRow(index, { grade: event.target.value || null })
                            }
                            dir="auto"
                            className="field h-9 w-28 rounded-lg px-2.5 text-xs text-ink-high outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.qualification ?? ''}
                            onChange={(event) =>
                              updateRow(index, { qualification: event.target.value || null })
                            }
                            dir="auto"
                            className="field h-9 w-44 rounded-lg px-2.5 text-xs text-ink-high outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.qualificationYear ?? ''}
                            onChange={(event) => {
                              const value = event.target.value.trim()
                              updateRow(index, {
                                qualificationYear: value ? Number(value) : null
                              })
                            }}
                            inputMode="numeric"
                            dir="ltr"
                            className="field h-9 w-24 rounded-lg px-2.5 text-xs text-ink-high outline-none"
                          />
                        </td>
                        <td className="px-2 py-2">{dateCell(row, 'gradeDate', index)}</td>
                        <td className="px-2 py-2">{dateCell(row, 'birthDate', index)}</td>
                        <td className="px-2 py-2">{dateCell(row, 'permanentDate', index)}</td>
                        <td className="px-2 py-2">{dateCell(row, 'hireDate', index)}</td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="text-[11px] text-ink-low transition-colors hover:text-rose-400"
                          >
                            {t('common.remove')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
