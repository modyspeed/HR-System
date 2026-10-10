/**
 * Employee status transitions (تغيير الحالة الوظيفية) with a full audit trail.
 *
 * `status` is the authoritative field; `isActive` on the row is kept derived
 * from it (`active` is the only live status). Every change appends a row to
 * `EmployeeStatusHistory` recording the acting user and the reason, so the
 * dossier always shows the complete timeline of statuses.
 */
import { PrismaClient } from '@prisma/client'
import { ApiError } from '../../shared/types'
import type { EmployeeStatusHistoryRecord } from '../../shared/types'
import {
  ACTIVE_EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_KEYS,
  RETIREMENT_AGE_YEARS,
  isActiveStatus
} from '../../shared/employeeStatuses'

type HistoryRow = {
  id: string
  employeeId: string
  fromStatus: string
  toStatus: string
  reason: string | null
  changedBy: string | null
  changedAt: Date
}

export function toStatusHistoryRecord(row: HistoryRow): EmployeeStatusHistoryRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString()
  }
}

/**
 * Changes the employee's status and logs the transition.
 * Transitioning to the current status is an idempotent no-op (no history row).
 */
export async function changeEmployeeStatus(
  prisma: PrismaClient,
  employeeId: string,
  input: { status: string; reason?: string },
  changedBy: string | null = null
): Promise<void> {
  const status = input.status?.trim()
  if ((EMPLOYEE_STATUS_KEYS as readonly string[]).indexOf(status) === -1) {
    throw new ApiError('VALIDATION', 'Unknown employee status')
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) throw new ApiError('NOT_FOUND', 'Employee not found')
  if (employee.status === status) return

  const reason = input.reason?.trim() || null
  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employeeId },
      data: { status, isActive: isActiveStatus(status) }
    }),
    prisma.employeeStatusHistory.create({
      data: {
        employeeId,
        fromStatus: employee.status,
        toStatus: status,
        reason,
        changedBy: changedBy || null
      }
    })
  ])
}

/** Full status timeline, newest first. */
export async function getStatusHistory(
  prisma: PrismaClient,
  employeeId: string
): Promise<EmployeeStatusHistoryRecord[]> {
  const rows = await prisma.employeeStatusHistory.findMany({
    where: { employeeId },
    orderBy: { changedAt: 'desc' }
  })
  return rows.map(toStatusHistoryRecord)
}

/** اليوم الذي يبلغ فيه المولود في `birthDate` السن القانونية للمعاش. */
export function retirementThreshold(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear() - RETIREMENT_AGE_YEARS,
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59
    )
  )
}

/**
 * التحويل الديناميكي للمعاش: كل موظف نشط بلغ سن المعاش القانوني يُحوَّل
 * تلقائيًا إلى «محال للمعاش» مرة واحدة، مع تسجيل الانتقال في السجل التاريخي.
 * الملف القديم يحتفظ بحالته بعد إعادة التعيين — الملف الجديد يُنشأ مستقلاً.
 */
export async function applyAutomaticRetirement(prisma: PrismaClient): Promise<number> {
  const threshold = retirementThreshold()
  const candidates = await prisma.employee.findMany({
    where: {
      status: ACTIVE_EMPLOYEE_STATUS,
      birthDate: { not: null, lte: threshold }
    },
    select: { id: true }
  })

  let converted = 0
  for (const candidate of candidates) {
    await changeEmployeeStatus(
      prisma,
      candidate.id,
      { status: 'retired', reason: 'بلوغ سن المعاش القانوني — تحويل تلقائي' },
      'النظام'
    )
    converted += 1
  }
  return converted
}

/**
 * عقد جديد بنفس بيانات الملف السابق: يُنشأ سجل موظف جديد (رقم جديد + نوع
 * تعاقد جديد) منسوخًا منه البيانات الشخصية، ويربط `rehiredFromId` بالملف
 * الأصلي الذي يبقى كما هو بحالته المحفوظة.
 */
export async function rehireEmployee(
  prisma: PrismaClient,
  sourceId: string,
  input: {
    code: string
    contractType?: string | null
    contractTypeId?: string | null
    hireDate?: string | null
  }
): Promise<{ id: string }> {
  const source = await prisma.employee.findUnique({ where: { id: sourceId } })
  if (!source) throw new ApiError('NOT_FOUND', 'Employee not found')

  const code = input.code.trim()
  if (!code) throw new ApiError('VALIDATION', 'Employee code is required')
  const clash = await prisma.employee.findUnique({ where: { code } })
  if (clash) throw new ApiError('CONFLICT', 'An employee with this code already exists')

  const hireDate =
    input.hireDate && /^\d{4}-\d{2}-\d{2}$/.test(input.hireDate.trim())
      ? new Date(`${input.hireDate.trim()}T00:00:00.000Z`)
      : new Date()

  // نوع التعاقد من الكتالوج يسبق النص الحر — الاسم يُشتق من المعرف.
  let contractType = input.contractType?.trim() || null
  if (input.contractTypeId?.trim()) {
    const type = await prisma.contractType.findUnique({
      where: { id: input.contractTypeId.trim() }
    })
    if (!type) throw new ApiError('VALIDATION', 'Unknown contract type')
    contractType = type.name
  }

  const created = await prisma.employee.create({
    data: {
      code,
      name: source.name,
      insuranceNo: source.insuranceNo,
      nationalId: source.nationalId,
      birthDate: source.birthDate,
      qualification: source.qualification,
      qualificationYear: source.qualificationYear,
      departmentId: source.departmentId,
      contractType,
      hireDate,
      status: ACTIVE_EMPLOYEE_STATUS,
      isActive: true,
      rehiredFromId: source.id
    }
  })
  return { id: created.id }
}
