import { LEAVE_STATUS_KEYS, LEAVE_TYPE_KEYS } from '@shared/leaves'

export type { LeaveStatusKey, LeaveTypeKey } from '@shared/leaves'
export { LEAVE_STATUS_KEYS, LEAVE_TYPE_KEYS }

export type BadgeTone = 'gold' | 'teal' | 'violet' | 'rose' | 'neutral'

/** Per-type accent — keeps the Egyptian-law catalogue visually legible. */
const TYPE_TONES: Record<string, BadgeTone> = {
  annual: 'gold',
  casual: 'teal',
  sick: 'rose',
  maternity: 'violet',
  hajj: 'gold',
  companion: 'teal',
  unpaid: 'neutral',
  sports: 'violet',
  compensatory: 'teal',
  marriage: 'violet',
  mourning: 'neutral',
  exam: 'teal'
}

const STATUS_TONES: Record<string, BadgeTone> = {
  pending: 'gold',
  approved: 'teal',
  rejected: 'rose'
}

export function leaveTypeTone(type: string): BadgeTone {
  return TYPE_TONES[type] ?? 'neutral'
}

export function leaveStatusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral'
}
