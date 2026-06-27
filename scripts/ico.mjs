// ICO 容器封装器：把多张已编码 PNG 打包成单个 .ico。
// ICO 自 Vista 起支持每个条目直接内嵌 PNG 数据，无需 BMP 编码，
// 因此这里只做容器组装，像素数据由调用方用 sharp 预先编码为 PNG。
import { Buffer } from 'node:buffer'

const ICONDIR_SIZE = 6
const ICONDIRENTRY_SIZE = 16

/**
 * @param {{size:number, buffer:Buffer}[]} pngEntries 每项是某一边长(px)的方形 PNG buffer
 * @returns {Buffer} 合法 ICO 容器
 */
export function pngBuffersToIco(pngEntries) {
  const entries = [...pngEntries].sort((a, b) => a.size - b.size)
  const header = Buffer.alloc(ICONDIR_SIZE)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(ICONDIRENTRY_SIZE * entries.length)
  let offset = ICONDIR_SIZE + dir.length
  const blobs = []

  entries.forEach((entry, i) => {
    const base = i * ICONDIRENTRY_SIZE
    // 256px 在 ICO 中以 0 表示
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, base + 0) // width
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, base + 1) // height
    dir.writeUInt8(0, base + 2) // color count
    dir.writeUInt8(0, base + 3) // reserved
    dir.writeUInt16LE(1, base + 4) // color planes
    dir.writeUInt16LE(32, base + 6) // bits per pixel
    dir.writeUInt32LE(entry.buffer.length, base + 8) // bytes in resource
    dir.writeUInt32LE(offset, base + 12) // offset
    offset += entry.buffer.length
    blobs.push(entry.buffer)
  })

  return Buffer.concat([header, dir, ...blobs])
}
