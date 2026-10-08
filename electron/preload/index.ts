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
  departments: {
    list: (query) => ipcRenderer.invoke('departments:list', query),
    getById: (id) => ipcRenderer.invoke('departments:getById', id),
    create: (input) => ipcRenderer.invoke('departments:create', input),
    update: (id, input) => ipcRenderer.invoke('departments:update', id, input),
    remove: (id) => ipcRenderer.invoke('departments:remove', id),
    parseImportFile: (payload) => ipcRenderer.invoke('departments:parseImportFile', payload),
    importRows: (rows) => ipcRenderer.invoke('departments:importRows', rows)
  },
  employees: {
    list: (query) => ipcRenderer.invoke('employees:list', query),
    getById: (id) => ipcRenderer.invoke('employees:getById', id),
    create: (input) => ipcRenderer.invoke('employees:create', input),
    update: (id, input) => ipcRenderer.invoke('employees:update', id, input),
    remove: (id) => ipcRenderer.invoke('employees:remove', id),
    setStatus: (id, input) => ipcRenderer.invoke('employees:setStatus', id, input),
    statusHistory: (id) => ipcRenderer.invoke('employees:statusHistory', id),
    parseImportFile: (payload) => ipcRenderer.invoke('employees:parseImportFile', payload),
    importRows: (rows) => ipcRenderer.invoke('employees:importRows', rows),
    attachFile: (payload) => ipcRenderer.invoke('employees:attachFile', payload),
    removeFile: (id) => ipcRenderer.invoke('employees:removeFile', id),
    previewFile: (id) => ipcRenderer.invoke('employees:previewFile', id),
    revealFilesDir: () => ipcRenderer.invoke('employees:revealFilesDir')
  },
  export: {
    toPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
    toExcel: (payload) => ipcRenderer.invoke('export:excel', payload)
  },
  leaves: {
    list: (query) => ipcRenderer.invoke('leaves:list', query),
    getById: (id) => ipcRenderer.invoke('leaves:getById', id),
    create: (input) => ipcRenderer.invoke('leaves:create', input),
    update: (id, input) => ipcRenderer.invoke('leaves:update', id, input),
    remove: (id) => ipcRenderer.invoke('leaves:remove', id),
    attachFile: (payload) => ipcRenderer.invoke('leaves:attachFile', payload),
    removeFile: (id) => ipcRenderer.invoke('leaves:removeFile', id),
    previewFile: (id) => ipcRenderer.invoke('leaves:previewFile', id),
    revealFilesDir: () => ipcRenderer.invoke('leaves:revealFilesDir')
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
