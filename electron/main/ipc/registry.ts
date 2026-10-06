import { ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * Thin registration surface passed to module IPC files so channel names stay
 * centralised and handlers remain trivially mockable.
 */
export interface IpcRegistry {
  // IPC payloads cross the process boundary as plain JSON, so handler args are
  // intentionally loose; each handler narrows them with its own shared type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => unknown): void
}

export function createIpcRegistry(): IpcRegistry {
  return {
    handle(channel, handler) {
      ipcMain.handle(channel, (event, ...args) => handler(event, ...args))
    }
  }
}
