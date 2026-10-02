# LeaveDesk

## Requirements
- Node.js 20.19+ (Node.js 24 recommended)
- npm 10+
- Windows build tools may be required if a prebuilt `better-sqlite3` binary is unavailable

## Install
```powershell
npm install
```

The install script rebuilds `better-sqlite3` for the bundled Electron version.

## Development
```powershell
npm run dev
```

The first launch creates `%USERPROFILE%\Documents\LeaveDeskData\leavedesk.db` and the `employee_files`, `backups`, and `imports` folders.

The current shell is the P1b layout: RTL app shell, light/dark/system theme switching, dashboard, and design gallery preview.

P2 provides the employee/department screens and employee profile. P2.1 refactors their backend service and IPC contract to coded result envelopes; employee data is available only in Electron, and browser preview returns `NOT_IN_APP`.

## Build
```powershell
npm run build
```

## Type check and tests
```powershell
npm run typecheck
npm test
npm run test:db
```

`test:db` runs `*.db.test.ts` under Electron's Node runtime (`ELECTRON_RUN_AS_NODE=1`) because `better-sqlite3` is rebuilt for Electron. The tests use a real temporary SQLite database and the project migrations.

P3 provides the full leave module: day-count calculator, balance service, leave-request lifecycle (create/decide/cancel), IPC surface, Zod schemas, real leave-request and leave-log pages, real dashboard with low-balance alerts, and real balance columns on the Employees page. All screens work in Light and Dark, Arabic RTL. No entitlement numbers are hardcoded — they are read from `leave_types` and `settings` in SQLite.