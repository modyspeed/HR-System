// electron-builder afterPack hook.
// The generated Prisma client (node_modules/.prisma) is not a real npm package,
// so electron-builder's dependency pruner drops it. Copy it back into the
// packaged app so the SQLite query engine ships with the app.
const fs = require('fs')
const path = require('path')

module.exports = function afterPack(context) {
  const appOutDir = context.appOutDir
  const packagedModules = path.join(appOutDir, 'resources', 'app', 'node_modules')
  const sourcePrisma = path.join(__dirname, '..', 'node_modules', '.prisma')

  if (!fs.existsSync(sourcePrisma)) {
    console.log('[afterPack] no generated Prisma client found, skipping')
    return
  }

  fs.mkdirSync(path.join(packagedModules, '.prisma'), { recursive: true })
  copyDir(sourcePrisma, path.join(packagedModules, '.prisma'))
  console.log('[afterPack] copied node_modules/.prisma into the packaged app')
}

function copyDir(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else if (entry.isSymbolicLink()) continue
    else fs.copyFileSync(from, to)
  }
}
