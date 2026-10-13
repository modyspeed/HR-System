/**
 * Single source of truth for the document folders stored under
 * `<Documents>/HR-System`.
 *
 * Every module that reads/writes a document folder and the backup/restore
 * pipeline derive their folder from here, so a newly added document type can
 * never be forgotten by the backup again.
 */
import { app } from 'electron'
import path from 'path'

export const DOCUMENT_FOLDERS = {
  employeeFiles: 'EmployeeFiles',
  leaveFiles: 'LeaveFiles',
  payrollFiles: 'PayrollFiles',
  salaryGradeFiles: 'SalaryGradeFiles',
  transferDecisionFiles: 'TransferDecisionFiles',
  incentiveRateFiles: 'IncentiveRateFiles',
  employeeIncentiveFiles: 'EmployeeIncentiveFiles',
  incentivePenaltyFiles: 'IncentivePenaltyFiles'
} as const

export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[keyof typeof DOCUMENT_FOLDERS]

/** Every backed-up document folder, in a stable order. */
export const FILE_FOLDERS: readonly DocumentFolder[] = Object.values(DOCUMENT_FOLDERS)

/** Root folder holding all app documents: `<Documents>/HR-System`. */
export function getAppDocsDir(): string {
  return path.join(app.getPath('documents'), 'HR-System')
}

/** Absolute path of a single document folder. */
export function getDocumentFolderDir(folder: DocumentFolder): string {
  return path.join(getAppDocsDir(), folder)
}
