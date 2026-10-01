# LeaveDesk P1a

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

## Build
```powershell
npm run build
```

## Type check and tests
```powershell
npm run typecheck
npm test
```