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

/**
 * Baseline permission set for every system role. Kept in one place so the
 * first-run seed and the recurring sync below never drift apart.
 *
 * Keys derived from the current catalogue land here automatically, so
 * permissions added in a later release (e.g. `departments.*`) reach existing
 * installs without an admin having to re-edit each role by hand.
 */
const SYSTEM_ROLE_PERMISSIONS: Record<string, (keys: readonly string[]) => string[]> = {
  [SUPER_ADMIN.key]: (keys) => [...keys],
  [HR_MANAGER.key]: (keys) => keys.filter((key) => key !== 'roles.delete'),
  [EMPLOYEE.key]: () => ['settings.view']
}

/** أنواع العقود الافتراضية وفق قانون العمل المصري والممارسات الشائعة. */
export const CONTRACT_TYPE_DEFAULTS = [
  'دائم',
  'مؤقت',
  'موسمي',
  'دوام جزئي',
  'تدريب / اختبار',
  'مهمة محددة',
  'مكافأة شاملة',
  'سنوي'
]

/**
 * مزامنة كتالوج أنواع التعاقد: يضمن وجود القائمة الافتراضية + كل اسم مستخدم
 * حاليًا عند الموظفين (حتى «م شاملة» من البيانات القديمة)، ويربط الأعمدة
 * القديمة بالكتالوج مرة واحدة.
 */
export async function syncContractTypes(prisma: PrismaClient): Promise<void> {
  const used = await prisma.employee.findMany({
    where: { contractType: { not: null } },
    distinct: ['contractType'],
    select: { contractType: true }
  })
  const names = new Map<string, string>()
  for (const name of CONTRACT_TYPE_DEFAULTS) names.set(name, name)
  for (const row of used) {
    const name = row.contractType?.trim()
    if (name) names.set(name, name)
  }
  for (const name of names.keys()) {
    await prisma.contractType.upsert({
      where: { name },
      create: { name },
      update: {}
    })
  }

  // ربط أعمدة التعاقد النصية القديمة بأصناف الكتالوج (مرة واحدة، Idempotent).
  const unlinked = await prisma.employee.findMany({
    where: { contractTypeId: null, contractType: { not: null } },
    select: { id: true, contractType: true }
  })
  for (const employee of unlinked) {
    const type = await prisma.contractType.findUnique({
      where: { name: employee.contractType!.trim() }
    })
    if (type) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { contractTypeId: type.id }
      })
    }
  }
}

export async function seedIfNeeded(prisma: PrismaClient): Promise<void> {
  const flag = await prisma.setting.findUnique({ where: { key: SEED_FLAG } })
  if (!flag) {
    await seedRoles(prisma)
    await seedAdmin(prisma)

    await prisma.setting.upsert({
      where: { key: 'app.language' },
      create: { key: 'app.language', value: 'ar' },
      update: {}
    })
    await prisma.setting.create({ data: { key: SEED_FLAG, value: new Date().toISOString() } })
  }

  // Always reconcile system roles with the catalogue — adds missing baseline
  // permissions only, never revokes, so manual tweaks by an admin survive.
  await syncSystemRolePermissions(prisma)
  await syncContractTypes(prisma)
}

async function seedRoles(prisma: PrismaClient): Promise<void> {
  await prisma.role.upsert({
    where: { key: SUPER_ADMIN.key },
    create: {
      key: SUPER_ADMIN.key,
      nameAr: SUPER_ADMIN.nameAr,
      nameEn: SUPER_ADMIN.nameEn,
      isSystem: true,
      permissions: {
        create: SYSTEM_ROLE_PERMISSIONS[SUPER_ADMIN.key](ALL_PERMISSION_KEYS).map(
          (permissionKey) => ({ permissionKey })
        )
      }
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
        create: SYSTEM_ROLE_PERMISSIONS[HR_MANAGER.key](ALL_PERMISSION_KEYS).map(
          (permissionKey) => ({ permissionKey })
        )
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
      permissions: {
        create: SYSTEM_ROLE_PERMISSIONS[EMPLOYEE.key](ALL_PERMISSION_KEYS).map(
          (permissionKey) => ({ permissionKey })
        )
      }
    },
    update: {}
  })
}

/**
 * Grants every system role the baseline permissions it is still missing.
 * Runs on each launch, so new permission keys reach roles that were seeded
 * before those keys existed.
 */
async function syncSystemRolePermissions(prisma: PrismaClient): Promise<void> {
  for (const roleKey of Object.keys(SYSTEM_ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } })
    if (!role) continue

    const wantedKeys = SYSTEM_ROLE_PERMISSIONS[roleKey](ALL_PERMISSION_KEYS)
    const granted = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionKey: true }
    })
    const held = new Set(granted.map((row) => row.permissionKey))
    const missing = wantedKeys.filter((permissionKey) => !held.has(permissionKey))
    if (missing.length === 0) continue

    await prisma.rolePermission.createMany({
      data: missing.map((permissionKey) => ({ roleId: role.id, permissionKey }))
    })
  }
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
