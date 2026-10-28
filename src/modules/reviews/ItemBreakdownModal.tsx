import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { PayrollItemColumn, PayrollItemMatrixRow } from '@shared/types'
import { Modal } from '@/components/ui/Modal'
import {
  DataTable,
  DataTableFoot,
  DataTableFootCell,
  DataTableFootRow,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeadRow
} from '@/components/ui/DataTable'

export type ItemBreakdownKind = 'earning' | 'deduction'

interface ItemBreakdownModalProps {
  open: boolean
  kind: ItemBreakdownKind | null
  row: PayrollItemMatrixRow | null
  columns: PayrollItemColumn[]
  periodLabel: string
  onClose: () => void
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * تفاصيل بند موظف واحد: قائمة كل بنود الاستحقاقات (أو الاستقطاعات)
 * مع قيمتها — تُفتح بالنقر على إجمالي الاستحقاق/الاستقطاعات في المصفوفة.
 */
export function ItemBreakdownModal({
  open,
  kind,
  row,
  columns,
  periodLabel,
  onClose
}: ItemBreakdownModalProps) {
  const { t } = useTranslation()

  const items = useMemo(() => {
    if (!row || !kind) return []
    return columns
      .map((column, index) => ({ column, value: row.values[index] }))
      .filter((entry) => entry.column.kind === kind && entry.value !== null)
      .map((entry) => ({ label: entry.column.label, value: entry.value as number }))
  }, [row, kind, columns])

  if (!row || !kind) return null

  const isEarning = kind === 'earning'
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const slipTotal = isEarning ? row.totalEarned : row.totalDeductions
  const differs = slipTotal !== null && Math.abs(slipTotal - total) > 0.05

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          {isEarning ? (
            <TrendingUp className="size-4.5 text-teal-400" />
          ) : (
            <TrendingDown className="size-4.5 text-rose-400" />
          )}
          {isEarning ? t('reviews.items.earnings') : t('reviews.items.deductions')}
          {' — '}
          {row.employeeName}
        </span>
      }
      description={`${t('reviews.items.employeeCode')} ${row.employeeCode} · ${row.departmentName ?? '—'} · ${periodLabel}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-ink-low">
            {t('export.count', { count: items.length })}
          </span>
          <span className="flex items-center gap-2 text-sm font-bold text-ink-high">
            {t('reviews.items.total')}
            <span dir="ltr" className="tabular-nums">
              {formatNumber(total)}
            </span>
          </span>
        </div>
      }
    >
      <div className="pb-4">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-low">
            {t('reviews.items.noBreakdown')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            <DataTable size="sm">
              <DataTableHead>
                <DataTableHeadRow dense>
                  <DataTableHeadCell dense>
                    {t('reviews.items.itemName')}
                  </DataTableHeadCell>
                  <DataTableHeadCell dense align="center">
                    {t('reviews.items.value')}
                  </DataTableHeadCell>
                </DataTableHeadRow>
              </DataTableHead>
              <tbody className="divide-y divide-surface-base">
                {items.map((item) => (
                  <tr key={item.label} className="transition-colors hover:bg-surface-soft">
                    <td className="px-4 py-2.5 text-xs text-ink-med">{item.label}</td>
                    <td
                      dir="ltr"
                      className={`px-4 py-2.5 text-end text-xs font-semibold tabular-nums ${
                        isEarning ? 'text-teal-300' : 'text-rose-300'
                      }`}
                    >
                      {formatNumber(item.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <DataTableFoot>
                <DataTableFootRow className="text-xs">
                  <DataTableFootCell align="start">{t('reviews.items.total')}</DataTableFootCell>
                  <DataTableFootCell className="tabular-nums" align="center" dir="ltr">
                    {formatNumber(total)}
                  </DataTableFootCell>
                </DataTableFootRow>
              </DataTableFoot>
            </DataTable>
          </div>
        )}

        {row.balance > 0 && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-[11px] leading-relaxed text-amber-300">
            {t('reviews.items.balanceNote', { value: formatNumber(row.balance) })}
          </p>
        )}

        {differs && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-[11px] leading-relaxed text-amber-300">
            {t('reviews.items.slipTotalNote', { value: formatNumber(slipTotal) })}
          </p>
        )}
      </div>
    </Modal>
  )
}
