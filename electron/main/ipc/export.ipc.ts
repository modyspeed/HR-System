import { ApiError } from '../../../shared/types'
import type { ExportPayload } from '../../../shared/types'
import { requirePermission } from '../auth'
import { exportToExcel, exportToPdf } from '../export/report'
import type { IpcRegistry } from './registry'

/** Exporting a list is a read of that list — reuse the module's view right. */
const PERMISSION_BY_SCOPE: Record<string, string> = {
  employees: 'employees.view',
  departments: 'departments.view',
  leaves: 'leaves.view',
  payrolls: 'payrolls.view'
}

function guard(payload: ExportPayload): void {
  const permission = PERMISSION_BY_SCOPE[payload?.scope]
  if (!permission) throw new ApiError('VALIDATION', 'Unknown export scope')
  requirePermission(permission)
}

export function registerExportIpc(ipc: IpcRegistry): void {
  ipc.handle('export:pdf', async (_event, payload: ExportPayload) => {
    guard(payload)
    return exportToPdf(payload)
  })

  ipc.handle('export:excel', async (_event, payload: ExportPayload) => {
    guard(payload)
    return exportToExcel(payload)
  })
}
