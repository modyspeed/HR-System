import { contextBridge, ipcRenderer } from 'electron'
import type { ApiShape, AppSettings } from '../../shared/types'

const api: ApiShape = {
  retirements: {
    list: (query) => ipcRenderer.invoke('retirements:list', query)
  },
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
    rehire: (id, input) => ipcRenderer.invoke('employees:rehire', id, input),
    linkRehire: (id, sourceId) => ipcRenderer.invoke('employees:linkRehire', id, sourceId),
    departmentTransfers: {
      listByEmployee: (employeeId) => ipcRenderer.invoke('employees:departmentTransfers.listByEmployee', employeeId),
      create: (input) => ipcRenderer.invoke('employees:departmentTransfers.create', input),
      update: (id, input) => ipcRenderer.invoke('employees:departmentTransfers.update', id, input),
      remove: (id) => ipcRenderer.invoke('employees:departmentTransfers.remove', id),
      attachDecision: (payload) => ipcRenderer.invoke('employees:departmentTransfers.attachDecision', payload),
      removeDecision: (id) => ipcRenderer.invoke('employees:departmentTransfers.removeDecision', id),
      previewDecision: (id) => ipcRenderer.invoke('employees:departmentTransfers.previewDecision', id)
    },
    setStatus: (id, input) => ipcRenderer.invoke('employees:setStatus', id, input),
    statusHistory: (id) => ipcRenderer.invoke('employees:statusHistory', id),
    contractTypeList: () => ipcRenderer.invoke('employees:contractTypeList'),
    contractTypeCreate: (input) => ipcRenderer.invoke('employees:contractTypeCreate', input),
    contractTypeUpdate: (id, input) => ipcRenderer.invoke('employees:contractTypeUpdate', id, input),
    contractTypeRemove: (id) => ipcRenderer.invoke('employees:contractTypeRemove', id),
    parseImportFile: (payload) => ipcRenderer.invoke('employees:parseImportFile', payload),
    importRows: (rows) => ipcRenderer.invoke('employees:importRows', rows),
    attachFile: (payload) => ipcRenderer.invoke('employees:attachFile', payload),
    removeFile: (id) => ipcRenderer.invoke('employees:removeFile', id),
    previewFile: (id) => ipcRenderer.invoke('employees:previewFile', id),
    revealFilesDir: () => ipcRenderer.invoke('employees:revealFilesDir')
  },
  export: {
    toPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
    toExcel: (payload) => ipcRenderer.invoke('export:excel', payload),
    toWord: (payload) => ipcRenderer.invoke('export:word', payload),
    toImage: (payload) => ipcRenderer.invoke('export:image', payload),
    toPrint: (payload) => ipcRenderer.invoke('export:print', payload)
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
  payrolls: {
    list: (query) => ipcRenderer.invoke('payrolls:list', query),
    listByEmployee: (employeeId) => ipcRenderer.invoke('payrolls:listByEmployee', employeeId),
    parsePdf: (payload) => ipcRenderer.invoke('payrolls:parsePdf', payload),
    importPdf: (payload) => ipcRenderer.invoke('payrolls:importPdf', payload),
    previewEntry: (id) => ipcRenderer.invoke('payrolls:previewEntry', id),
    remove: (id) => ipcRenderer.invoke('payrolls:remove', id),
    items: {
      list: (query) => ipcRenderer.invoke('payrolls:items.list', query),
      periods: (query) => ipcRenderer.invoke('payrolls:items.periods', query),
      absences: (query) => ipcRenderer.invoke('payrolls:items.absences', query),
      absenceReview: (query) => ipcRenderer.invoke('payrolls:items.absenceReview', query),
      saveAbsenceReviewNote: (input) =>
        ipcRenderer.invoke('payrolls:items.absenceReview.saveNote', input),
      syncAbsences: (query) => ipcRenderer.invoke('payrolls:items.absences.sync', query),
      sync: (query) => ipcRenderer.invoke('payrolls:items.sync', query)
    },
    salaryGrades: {
      listByEmployee: (employeeId) => ipcRenderer.invoke('payrolls:salaryGrades.listByEmployee', employeeId),
      create: (input) => ipcRenderer.invoke('payrolls:salaryGrades.create', input),
      update: (id, input) => ipcRenderer.invoke('payrolls:salaryGrades.update', id, input),
      remove: (id) => ipcRenderer.invoke('payrolls:salaryGrades.remove', id),
      attachFile: (payload) => ipcRenderer.invoke('payrolls:salaryGrades.attachFile', payload),
      removeFile: (id) => ipcRenderer.invoke('payrolls:salaryGrades.removeFile', id),
      previewFile: (id) => ipcRenderer.invoke('payrolls:salaryGrades.previewFile', id)
    },
    incentiveRates: {
      list: (query) => ipcRenderer.invoke('payrolls:incentiveRates.list', query),
      listByDepartment: (departmentId) => ipcRenderer.invoke('payrolls:incentiveRates.listByDepartment', departmentId),
      create: (input) => ipcRenderer.invoke('payrolls:incentiveRates.create', input),
      update: (id, input) => ipcRenderer.invoke('payrolls:incentiveRates.update', id, input),
      remove: (id) => ipcRenderer.invoke('payrolls:incentiveRates.remove', id),
      parsePdf: (payload) => ipcRenderer.invoke('payrolls:incentiveRates.parsePdf', payload),
      importPdf: (payload) => ipcRenderer.invoke('payrolls:incentiveRates.importPdf', payload),
      preview: (id) => ipcRenderer.invoke('payrolls:incentiveRates.preview', id)
    },
    employeeIncentiveRates: {
      list: (query) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.list', query),
      listByEmployee: (employeeId) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.listByEmployee', employeeId),
      create: (input) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.create', input),
      update: (id, input) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.update', id, input),
      remove: (id) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.remove', id),
      parsePdf: (payload) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.parsePdf', payload),
      importPdf: (payload) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.importPdf', payload),
      preview: (id) => ipcRenderer.invoke('payrolls:employeeIncentiveRates.preview', id)
    },
    incentivePenalties: {
      list: (query) => ipcRenderer.invoke('payrolls:incentivePenalties.list', query),
      listByEmployee: (employeeId) => ipcRenderer.invoke('payrolls:incentivePenalties.listByEmployee', employeeId),
      create: (input) => ipcRenderer.invoke('payrolls:incentivePenalties.create', input),
      update: (id, input) => ipcRenderer.invoke('payrolls:incentivePenalties.update', id, input),
      remove: (id) => ipcRenderer.invoke('payrolls:incentivePenalties.remove', id),
      parsePdf: (payload) => ipcRenderer.invoke('payrolls:incentivePenalties.parsePdf', payload),
      importPdf: (payload) => ipcRenderer.invoke('payrolls:incentivePenalties.importPdf', payload),
      preview: (id) => ipcRenderer.invoke('payrolls:incentivePenalties.preview', id)
    }
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    setLanguage: (language) => ipcRenderer.invoke('settings:setLanguage', language),
    setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme)
  },
  system: {
    versions: () => ipcRenderer.invoke('system:versions'),
    revealDatabase: () => ipcRenderer.invoke('system:revealDatabase')
  },
  backups: {
    list: () => ipcRenderer.invoke('backup:list'),
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (fileName) => ipcRenderer.invoke('backup:restore', fileName),
    remove: (fileName) => ipcRenderer.invoke('backup:remove', fileName),
    revealDir: () => ipcRenderer.invoke('backup:revealDir')
  },
  dashboard: {
    summary: () => ipcRenderer.invoke('dashboard:summary')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
