import type { ApiShape } from '@shared/types'

/**
 * The renderer's only data channel. Everything else reaches the database
 * through this typed bridge (contextIsolation: true, nodeIntegration: false).
 */
export const api: ApiShape = (window as unknown as { api: ApiShape }).api
