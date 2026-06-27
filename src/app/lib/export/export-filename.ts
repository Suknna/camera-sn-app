import { createLocalAppError } from '@app/lib/local-errors'

interface BuildExportFileNameInput {
  dataCenterName: string
  roomName: string
  exportedAt: Date | string | number
}

const illegalFilenameCharacters = /[<>:"/\\|?*\u0000-\u001f]/g

export function buildExportFileName({
  dataCenterName,
  roomName,
  exportedAt,
}: BuildExportFileNameInput): string {
  const dataCenter = sanitizeFilenamePart(dataCenterName)
  const room = sanitizeFilenamePart(roomName)
  const timestamp = formatExportTimestamp(exportedAt)

  if (!dataCenter || !room)
    throw createLocalAppError('EXPORT_FILE_WRITE_FAILED')

  return `${dataCenter}-${room}-${timestamp}.xlsx`
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(illegalFilenameCharacters, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatExportTimestamp(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createLocalAppError('EXPORT_FILE_WRITE_FAILED')
  }

  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  const second = pad2(date.getSeconds())

  return `${year}${month}${day}-${hour}${minute}${second}`
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}
