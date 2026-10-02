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

P2 adds SQLite-backed employee/department screens and employee profile data. Employee data is available only in the Electron app; browser preview reports that the feature is app-only.

## Build
```powershell
npm run build
```

## Type check and tests
```powershell
npm run typecheck
npm test
npm run test:sqlite
```

`test:sqlite` runs employee service tests under Electron's Node runtime (`ELECTRON_RUN_AS_NODE=1`) because `better-sqlite3` is rebuilt for Electron. Those tests use real temporary SQLite databases and the project migrations.