import { contextBridge, ipcRenderer } from 'electron'
import type { ApiShape, AppSettings } from '../../shared/types'

const api: ApiShape = {
  auth: {
    login: (payload) => ipcRenderer.invoke('auth:login', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    me: () => ipcRenderer.invoke('auth:me'),
    bootstrap: () => ipcRenderer.invoke('auth:bootstrap') as Promise<AppSettings>
  },
  users: {
    list: (query) => ipcRenderer.invoke('users:list', query),
    getById: (id) => ipcRenderer.invoke('users:getById', id),
    create: (input) => ipcRenderer.invoke('users:create', input),
    update: (id, input) => ipcRenderer.invoke('users:update', id, input),
    setStatus: (id, isActive) => ipcRenderer.invoke('users:setStatus', id, isActive),
    remove: (id) => ipcRenderer.invoke('users:remove', id),
    checkUnique: (check) => ipcRenderer.invoke('users:checkUnique', check),
    changePassword: (input) => ipcRenderer.invoke('users:changePassword', input)
  },
  roles: {
    list: () => ipcRenderer.invoke('roles:list'),
    getById: (id) => ipcRenderer.invoke('roles:getById', id),
    create: (input) => ipcRenderer.invoke('roles:create', input),
    update: (id, input) => ipcRenderer.invoke('roles:update', id, input),
    remove: (id) => ipcRenderer.invoke('roles:remove', id),
    setPermissions: (id, keys) => ipcRenderer.invoke('roles:setPermissions', id, keys)
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    setLanguage: (language) => ipcRenderer.invoke('settings:setLanguage', language),
    setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme)
  },
  system: {
    versions: () => ipcRenderer.invoke('system:versions'),
    revealDatabase: () => ipcRenderer.invoke('system:revealDatabase')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
