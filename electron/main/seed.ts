import { PrismaClient } from '@prisma/client'
import { ALL_PERMISSION_KEYS, SUPER_ADMIN_ROLE_KEY } from '../../shared/permissions'
import { hashPassword } from './auth'

const SEED_FLAG = 'app.seeded'
const SUPER_ADMIN = {
  key: SUPER_ADMIN_ROLE_KEY,
  nameAr: 'المدير العام',
  nameEn: 'Super Admin'
}
const HR_MANAGER = {
  key: 'hr_manager',
  nameAr: 'مدير الموارد البشرية',
  nameEn: 'HR Manager'
}
const EMPLOYEE = {
  key: 'employee',
  nameAr: 'موظف',
  nameEn: 'Employee'
}

export async function seedIfNeeded(prisma: PrismaClient): Promise<void> {
  const flag = await prisma.setting.findUnique({ where: { key: SEED_FLAG } })
  if (flag) return

  await seedRoles(prisma)
  await seedAdmin(prisma)

  await prisma.setting.upsert({
    where: { key: 'app.language' },
    create: { key: 'app.language', value: 'ar' },
    update: {}
  })
  await prisma.setting.create({ data: { key: SEED_FLAG, value: new Date().toISOString() } })
}

async function seedRoles(prisma: PrismaClient): Promise<void> {
  await prisma.role.upsert({
    where: { key: SUPER_ADMIN.key },
    create: {
      key: SUPER_ADMIN.key,
      nameAr: SUPER_ADMIN.nameAr,
      nameEn: SUPER_ADMIN.nameEn,
      isSystem: true,
      permissions: { create: ALL_PERMISSION_KEYS.map((permissionKey) => ({ permissionKey })) }
    },
    update: {}
  })

  await prisma.role.upsert({
    where: { key: HR_MANAGER.key },
    create: {
      key: HR_MANAGER.key,
      nameAr: HR_MANAGER.nameAr,
      nameEn: HR_MANAGER.nameEn,
      isSystem: true,
      permissions: {
        create: ALL_PERMISSION_KEYS.filter((k) => k !== 'roles.delete').map((permissionKey) => ({
          permissionKey
        }))
      }
    },
    update: {}
  })

  await prisma.role.upsert({
    where: { key: EMPLOYEE.key },
    create: {
      key: EMPLOYEE.key,
      nameAr: EMPLOYEE.nameAr,
      nameEn: EMPLOYEE.nameEn,
      isSystem: true,
      permissions: { create: [{ permissionKey: 'settings.view' }] }
    },
    update: {}
  })
}

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (existing) return

  const role = await prisma.role.findUniqueOrThrow({ where: { key: SUPER_ADMIN.key } })

  await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'مدير النظام',
      email: 'admin@hr-system.local',
      passwordHash: await hashPassword('admin123'),
      roleId: role.id,
      isActive: true
    }
  })
}
