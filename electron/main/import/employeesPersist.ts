/**
 * Persists parsed employee rows (`employees:importRows`).
 *
 * Rows come from any source (Excel/PDF, possibly re-edited in the preview
 * modal), and the department + contract-type columns are optional: when a row
 * carries no department or no contract type, the value already stored on the
 * employee is kept instead of being cleared.
 *
 * Departments are matched by code first, then by name, and are created when
 * the file mentions one that does not exist yet.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import type { EmployeeImportRow, EmployeeImportSummary } from '../../../shared/types'
import { validateEmployeeImportRow } from './employeesImport'
import { normalizeHeader, toNameText } from './text'

type DepartmentRef = { id: string; code: string; name: string }

/**
 * Resolves a row's department, creating it when it is unknown.
 * Returns `null` when the row carries neither a code nor a name.
 */
async function resolveDepartment(
  tx: Prisma.TransactionClient,
  row: EmployeeImportRow,
  byCode: Map<string, DepartmentRef>,
  byName: Map<string, DepartmentRef>
): Promise<string | null> {
  const code = row.departmentCode?.trim() ?? ''
  const name = toNameText(row.departmentName)
  const codeKey = normalizeHeader(code)
  const nameKey = normalizeHeader(name)
  if (!codeKey && !nameKey) return null

  const match = (codeKey ? byCode.get(codeKey) : undefined) ?? (nameKey ? byName.get(nameKey) : undefined)
  if (match) return match.id

  // No code at all → fall back to the name so the code stays unique and the
  // row still resolves to a real department instead of being dropped.
  const department = await tx.department.create({
    data: { code: code || name, name: name || code }
  })
  byCode.set(normalizeHeader(department.code), department)
  byName.set(normalizeHeader(department.name), department)
  return department.id
}

export async function importEmployees(
  prisma: PrismaClient,
  rows: EmployeeImportRow[]
): Promise<EmployeeImportSummary> {
  let created = 0
  let updated = 0
  let skipped = 0

  await prisma.$transaction(
    async (tx) => {
      const validRows = rows.filter((row) => {
        if (validateEmployeeImportRow(row)) {
          skipped += 1
          return false
        }
        return true
      })

      const codes = [...new Set(validRows.map((row) => row.code.trim()))]
      const existing = await tx.employee.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true }
      })
      const existingByCode = new Map(existing.map((row) => [row.code, row.id]))

      const departments = await tx.department.findMany({ select: { id: true, code: true, name: true } })
      const byCode = new Map(departments.map((d) => [normalizeHeader(d.code), d]))
      const byName = new Map(departments.map((d) => [normalizeHeader(d.name), d]))

      for (const row of validRows) {
        const code = row.code.trim()
        const data = {
          code,
          name: row.name.trim(),
          insuranceNo: row.insuranceNo,
          nationalId: row.nationalId,
          grade: row.grade,
          gradeDate: dateOrNull(row.gradeDate),
          birthDate: dateOrNull(row.birthDate),
          permanentDate: dateOrNull(row.permanentDate),
          hireDate: dateOrNull(row.hireDate),
          qualification: row.qualification,
          qualificationYear: row.qualificationYear
        }

        const departmentId = await resolveDepartment(tx, row, byCode, byName)
        const contractType = row.contractType?.trim() || null

        const existingId = existingByCode.get(code)
        if (existingId) {
          // Optional columns only patch what they carry; a re-import without
          // them keeps the department / contract type already on record.
          const patch: Prisma.EmployeeUncheckedUpdateInput = { ...data }
          if (departmentId) patch.departmentId = departmentId
          if (contractType) patch.contractType = contractType

          await tx.employee.update({ where: { id: existingId }, data: patch })
          updated += 1
        } else {
          const record = await tx.employee.create({
            data: { ...data, departmentId, contractType, isActive: true }
          })
          existingByCode.set(code, record.id)
          created += 1
        }
      }
    },
    { timeout: 60_000 }
  )

  return { created, updated, skipped }
}

/** `yyyy-mm-dd` → Date at UTC midnight, or null. */
function dateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return new Date(`${trimmed}T00:00:00.000Z`)
}
