import i18n from '@/i18n'
import { ApiError, type ApiErrorCode } from '@shared/types'

/** Maps a thrown main-process error to a localised user message. */
export function resolveApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return i18n.t(`errors.${error.code}`, { defaultValue: i18n.t('errors.default') })
  }

  // Errors crossing the IPC boundary arrive as plain objects.
  const maybeCode = (error as { code?: string })?.code
  if (maybeCode && i18n.exists(`errors.${maybeCode}`)) {
    return i18n.t(`errors.${maybeCode}`)
  }

  const message = (error as Error)?.message
  if (message && /username|email/i.test(message)) {
    return i18n.t('errors.CONFLICT')
  }

  return i18n.t('errors.default')
}

export function apiErrorCode(error: unknown): ApiErrorCode | null {
  const code = (error as { code?: string })?.code
  return (code as ApiErrorCode) ?? null
}
