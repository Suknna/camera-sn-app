// Camera SN 图片资产生成脚本。
// 三阶段：generate(调 gpt-image-2 生成母版) → web(sharp 派生 favicon/logo/封面)
//        → app(合成源图 + @capacitor/assets 生成原生图标/splash)。
// 设计依据：docs/superpowers/specs/2026-06-23-image-generation-and-login-redesign-design.md
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { pngBuffersToIco } from './ico.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..')
const ENV_PATH = path.join(REPO_ROOT, '.env')
const GENERATED_DIR = path.join(REPO_ROOT, 'design', 'generated')

const BRAND_MASTER = path.join(GENERATED_DIR, 'brand-master.png')
const LOGIN_COVER = path.join(GENERATED_DIR, 'login-cover.png')

const BRAND_PROMPT =
  'minimalist flat line icon, a scan viewfinder with four corner brackets ' +
  'framing a vertical barcode in the center, monochrome slate-blue color ' +
  '#2e3340 on a pure white background, clean geometric vector style, ' +
  'centered with generous padding, no text, no gradient, no shadow, no 3d'

const COVER_PROMPT =
  'abstract data center interior, rows of server racks rendered as clean ' +
  'geometric silhouettes with depth, cool slate-blue low-saturation palette, ' +
  'calm professional minimal mood, soft directional light, no people, ' +
  'no text, no logos, no watermark'

/** 容忍半角/全角冒号的 .env 解析；不修改源文件。 */
export async function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`.env not found at ${ENV_PATH}`)
  }
  const raw = await readFile(ENV_PATH, 'utf-8')
  const map = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const sepIndex = trimmed.search(/[:：]/)
    if (sepIndex === -1) continue
    const key = trimmed.slice(0, sepIndex).trim().toLowerCase()
    const value = trimmed.slice(sepIndex + 1).trim()
    if (key) map[key] = value
  }
  if (!map.endpoint) throw new Error('.env missing "endpoint"')
  if (!map.key) throw new Error('.env missing "key"')
  return { endpoint: map.endpoint, key: map.key }
}

async function generateImage({ endpoint, key }, prompt, size) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, size, n: 1 }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`image API HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  const json = await res.json()
  const b64 = json?.data?.[0]?.b64_json
  if (!b64) throw new Error('image API response missing data[0].b64_json')
  return Buffer.from(b64, 'base64')
}

async function normalizePng(buffer, size) {
  const [width, height] = size.split('x').map((value) => Number.parseInt(value, 10))
  return sharp(buffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
}

export async function generateMasters({ force = false } = {}) {
  await mkdir(GENERATED_DIR, { recursive: true })
  const env = await loadEnv()

  const jobs = [
    { file: BRAND_MASTER, prompt: BRAND_PROMPT, size: '1024x1024' },
    { file: LOGIN_COVER, prompt: COVER_PROMPT, size: '1024x1536' },
  ]
  for (const job of jobs) {
    if (!force && existsSync(job.file)) {
      console.log(`[generate] skip (exists): ${path.relative(REPO_ROOT, job.file)}`)
      continue
    }
    console.log(`[generate] requesting ${job.size} -> ${path.relative(REPO_ROOT, job.file)}`)
    const buf = await normalizePng(await generateImage(env, job.prompt, job.size), job.size)
    await writeFile(job.file, buf)
    console.log(`[generate] wrote ${buf.length} bytes`)
  }
}

const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public')
const ASSETS_DIR = path.join(FRONTEND_DIR, 'assets')
const BLUE = '#2e3340'

/** 从 brand-master 取「符号」alpha：符号在母版上是深色、底是白色。
 *  grayscale→negate 后，符号变高值(亮)、底变低值(暗)，作为不透明度掩码。 */
async function symbolAlphaMask(size) {
  return sharp(BRAND_MASTER)
    .resize(size, size, { fit: 'contain', background: '#ffffff' })
    .grayscale()
    .negate()
    .toColourspace('b-w')
    .toBuffer()
}

/** 生成「透明底 + 岩灰蓝符号」的 logo（用于浅色界面）。 */
async function blueSymbolOnTransparent(size) {
  const alpha = await symbolAlphaMask(size)
  const blueRgb = await sharp({
    create: { width: size, height: size, channels: 3, background: '#2e3340' },
  })
    .png()
    .toBuffer()
  return sharp(blueRgb).joinChannel(alpha).png().toBuffer()
}

export async function deriveWeb() {
  if (!existsSync(BRAND_MASTER)) throw new Error('brand-master missing; run generate first')
  if (!existsSync(LOGIN_COVER)) throw new Error('login-cover missing; run generate first')
  await mkdir(PUBLIC_DIR, { recursive: true })

  // favicon PNGs（蓝符号透明底，浏览器标签在浅色/深色下都可见轮廓）
  const sizes = [16, 32, 48]
  const pngBySize = {}
  for (const s of sizes) {
    pngBySize[s] = await blueSymbolOnTransparent(s)
  }
  await writeFile(path.join(PUBLIC_DIR, 'favicon-16.png'), pngBySize[16])
  await writeFile(path.join(PUBLIC_DIR, 'favicon-32.png'), pngBySize[32])

  // favicon.ico（16/32/48 多尺寸）
  const ico = pngBuffersToIco(sizes.map((s) => ({ size: s, buffer: pngBySize[s] })))
  await writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), ico)

  // apple-touch-icon 180×180（iOS 不喜欢透明，用白底蓝符号）
  const appleAlpha = await symbolAlphaMask(180)
  const whiteBg = await sharp({
    create: { width: 180, height: 180, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer()
  const blueLayer = await sharp({
    create: { width: 180, height: 180, channels: 3, background: '#2e3340' },
  })
    .png()
    .toBuffer()
  const appleSymbol = await sharp(blueLayer).joinChannel(appleAlpha).png().toBuffer()
  const appleIcon = await sharp(whiteBg)
    .composite([{ input: appleSymbol }])
    .png()
    .toBuffer()
  await writeFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleIcon)

  // logo-mark 512（透明底蓝符号，供登录页/侧边栏/App）
  await writeFile(path.join(PUBLIC_DIR, 'logo-mark.png'), await blueSymbolOnTransparent(512))

  // 登录封面优化：webp 主用 + jpg 兜底
  await sharp(LOGIN_COVER)
    .webp({ quality: 82 })
    .toFile(path.join(PUBLIC_DIR, 'login-cover.webp'))
  await sharp(LOGIN_COVER)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(PUBLIC_DIR, 'login-cover.jpg'))

  console.log('[web] derived favicon/logo/cover into frontend/public')
}

/** 蓝底 + 居中白符号，symbolScale 控制符号占比（安全区留白）。 */
async function blueIconWithWhiteSymbol(canvas, symbolScale) {
  const symSize = Math.round(canvas * symbolScale)
  const alpha = await symbolAlphaMask(symSize)
  const whiteLayer = await sharp({
    create: { width: symSize, height: symSize, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer()
  const whiteSymbol = await sharp(whiteLayer).joinChannel(alpha).png().toBuffer()
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: BLUE },
  })
    .composite([{ input: whiteSymbol, gravity: 'center' }])
    .png()
    .toBuffer()
}

function runCapacitorAssets() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['capacitor-assets', 'generate', '--ios', '--android'],
      { cwd: FRONTEND_DIR, stdio: 'inherit' }
    )
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`capacitor-assets exit ${code}`))
    )
  })
}

export async function deriveApp() {
  if (!existsSync(BRAND_MASTER)) throw new Error('brand-master missing; run generate first')
  await mkdir(ASSETS_DIR, { recursive: true })

  // 图标源图：蓝底白符号，符号占 ~62%（留安全区）
  await writeFile(
    path.join(ASSETS_DIR, 'icon-only.png'),
    await blueIconWithWhiteSymbol(1024, 0.62)
  )
  // 自适应图标前景：透明底白符号；背景：纯蓝
  const fgAlpha = await symbolAlphaMask(Math.round(1024 * 0.62))
  const fgWhite = await sharp({
    create: { width: Math.round(1024 * 0.62), height: Math.round(1024 * 0.62), channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer()
  const fgSymbol = await sharp(fgWhite).joinChannel(fgAlpha).png().toBuffer()
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
    .composite([{ input: fgSymbol, gravity: 'center' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon-foreground.png'))
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: BLUE } })
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon-background.png'))

  // splash：蓝底居中白符号（符号占比更小），亮/暗同图（品牌统一）
  const splash = await blueIconWithWhiteSymbol(2732, 0.28)
  await writeFile(path.join(ASSETS_DIR, 'splash.png'), splash)
  await writeFile(path.join(ASSETS_DIR, 'splash-dark.png'), splash)

  await runCapacitorAssets()
  console.log('[app] generated native icons and splash')
}

function parseArgs(argv) {
  const force = argv.includes('--force')
  const stageArg = argv.find((a) => a.startsWith('--stage='))
  const stage = stageArg ? stageArg.slice('--stage='.length) : 'all'
  return { force, stage }
}

async function main() {
  const { force, stage } = parseArgs(process.argv.slice(2))
  if (stage === 'all' || stage === 'generate') {
    await generateMasters({ force })
  }
  if (stage === 'all' || stage === 'web') {
    await deriveWeb()
  }
  if (stage === 'all' || stage === 'app') {
    await deriveApp()
  }
}

main().catch((err) => {
  console.error(`[generate-assets] ${err.message}`)
  process.exit(1)
})
