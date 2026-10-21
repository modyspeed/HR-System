/**
 * يضمن أن عميل Prisma المُولَّد مطابق تمامًا لـ `prisma/schema.prisma`.
 *
 * عند تعديل المخطط دون تشغيل `prisma generate` يفشل التطبيق عند أول استعلام
 * يستعمل نموذجًا جديدًا (مثال: `Unknown argument 'items'`)، فيظهر خطأ غامض
 * بدل رسالة واضحة. لذا يتحقق هذا السكربت من التطابق قبل كل تشغيل.
 *
 * التوليد نفسه يفشل على ويندوز إذا كان التطبيق يعمل (محرّك SQLite مقفول)،
 * لذلك نتخطّاه عندما يكون العميل مطابقًا للمخطط أصلًا.
 *
 * التشغيل:  node scripts/prisma-ensure.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const schemaPath = resolve(root, 'prisma', 'schema.prisma')
const generatedSchemaPath = resolve(root, 'node_modules', '.prisma', 'client', 'schema.prisma')
const prismaCli = resolve(root, 'node_modules', 'prisma', 'build', 'index.js')

/**
 * Prisma يكتب نسخة من المخطط بصياغة مُنسَّقة (محاذاة المسافات)، فلا يصلح
 * مقارنة النص حرفيًا. لذلك نقارن المخططين بعد تجاهل التعليقات والتخطيط.
 */
function normalize(text) {
  return text
    .replace(/(?<!:)\/\/[^\n]*/g, '') // تعليقات السطر، دون المسارات مثل https://
    .replace(/\s+/g, ' ')
    .trim()
}

/** هل العميل المُولَّد مبني على نفس المخطط الحالي؟ */
function isClientCurrent() {
  if (!existsSync(generatedSchemaPath)) return false
  try {
    const source = normalize(readFileSync(schemaPath, 'utf-8'))
    const generated = normalize(readFileSync(generatedSchemaPath, 'utf-8'))
    return source === generated
  } catch {
    return false
  }
}

if (isClientCurrent()) {
  console.log('[prisma] generated client is up to date — skipped')
} else {
  try {
    execFileSync(process.execPath, [prismaCli, 'generate'], {
      cwd: root,
      stdio: 'inherit'
    })
  } catch {
    console.error(
      '[prisma] generation failed. Close the running app first — it locks the SQLite query engine — then retry.'
    )
    process.exit(1)
  }
}
