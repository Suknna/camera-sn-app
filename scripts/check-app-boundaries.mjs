import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const adminSegment = 'adm' + 'in'
const bootstrapSegment = 'boot' + 'strap'

const forbiddenImports = [
  `@${adminSegment}/`,
  `@shared/api/${adminSegment}`,
  `@shared/api/${bootstrapSegment}`,
  `@shared/types/${adminSegment}`,
  `@shared/types/${bootstrapSegment}`,
]
const forbiddenContentPatterns = [
  /BOOTSTRAP_ALREADY_DONE/,
  /BOOTSTRAP/,
  new RegExp(`${bootstrapSegment[0].toUpperCase()}${bootstrapSegment.slice(1)}${adminSegment[0].toUpperCase()}${adminSegment.slice(1)}`),
  new RegExp(`Create${bootstrapSegment[0].toUpperCase()}${bootstrapSegment.slice(1)}${adminSegment[0].toUpperCase()}${adminSegment.slice(1)}`),
  new RegExp(`${adminSegment}_exists`),
  new RegExp(`${adminSegment}Guard`),
  new RegExp(`\\bfrom\\s+['"][^'"]*${bootstrapSegment}[^'"]*['"]`, 'i'),
  new RegExp(`\\bimport\\s+['"][^'"]*${bootstrapSegment}[^'"]*['"]`, 'i'),
  new RegExp(
    `\\bimport\\s*\\(\\s*['"][^'"]*${bootstrapSegment}[^'"]*['"]\\s*\\)`,
    'i'
  ),
  new RegExp(
    `(^|['"\`])\\/(api\\/v1\\/)?${adminSegment}(\\/|['"\`?#]|$)`
  ),
  new RegExp(
    `(^|['"\`])\\/(api\\/v1\\/)?${bootstrapSegment}(\\/|['"\`?#]|$)`
  ),
]
const roots = ['src/app', 'src/shared/api', 'src/shared/auth', 'src/shared/types']

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(fullPath) : fullPath
    })
  )
  return files.flat().filter((file) => /\.(ts|tsx)$/.test(file))
}

async function collect(root) {
  const fullPath = path.resolve(root)
  return /\.(ts|tsx)$/.test(fullPath) ? [fullPath] : walk(fullPath)
}

const files = (await Promise.all(roots.map(collect))).flat()
const violations = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  const relativePath = path.relative(process.cwd(), file)

  for (const forbiddenImport of forbiddenImports) {
    if (content.includes(forbiddenImport)) {
      violations.push(`${relativePath}: imports forbidden ${forbiddenImport}`)
    }
  }

  for (const forbiddenContentPattern of forbiddenContentPatterns) {
    if (forbiddenContentPattern.test(content)) {
      violations.push(
        `${relativePath}: matches forbidden content ${forbiddenContentPattern}`
      )
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log(
  `Checked ${files.length} app/shared files; no forbidden admin/bootstrap semantics found.`
)
