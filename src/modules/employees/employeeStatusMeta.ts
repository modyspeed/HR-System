import { EMPLOYEE_STATUS_KEYS, isActiveStatus } from '@shared/employeeStatuses'

export type { EmployeeStatusKey } from '@shared/employeeStatuses'
export { EMPLOYEE_STATUS_KEYS, isActiveStatus }

export type BadgeTone = 'gold' | 'teal' | 'violet' | 'rose' | 'neutral'

const STATUS_TONES: Record<string, BadgeTone> = {
  active: 'teal',
  unpaid_leave: 'gold',
  retired: 'violet',
  deceased: 'neutral',
  resigned: 'rose',
  terminated: 'rose',
  suspended: 'neutral'
}

export function employeeStatusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral'
}