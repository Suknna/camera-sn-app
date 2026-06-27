import { createLocalAppError, isLocalAppError } from '@app/lib/local-errors'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

interface ShareExcelBlobInput {
  blob: Blob
  fileName: string
}

export interface ShareExcelBlobResult {
  fileUri: string
  fileSize: number
  fileHash: string
}

export async function shareExcelBlob({
  blob,
  fileName,
}: ShareExcelBlobInput): Promise<ShareExcelBlobResult> {
  await assertCanShare()

  const fileHash = await hashBlob(blob)
  const fileData = await blobToBase64(blob)
  const fileUri = await writeCacheFile(fileName, fileData)

  try {
    await Share.share({ files: [fileUri] })
  } catch (error) {
    throw createLocalAppError('SHARE_FAILED', error)
  }

  return {
    fileUri,
    fileSize: blob.size,
    fileHash,
  }
}

async function assertCanShare(): Promise<void> {
  try {
    const canShare = await Share.canShare()
    if (!canShare.value) throw createLocalAppError('SHARE_UNAVAILABLE')
  } catch (error) {
    if (isLocalAppError(error)) throw error
    throw createLocalAppError('SHARE_UNAVAILABLE', error)
  }
}

async function writeCacheFile(
  fileName: string,
  base64Data: string
): Promise<string> {
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    })
    return result.uri
  } catch (error) {
    if (isLocalAppError(error)) throw error
    throw createLocalAppError('EXPORT_FILE_WRITE_FAILED', error)
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      const chunk = bytes.subarray(offset, offset + 0x8000)
      binary += String.fromCharCode(...chunk)
    }
    return globalThis.btoa(binary)
  } catch (error) {
    throw createLocalAppError('EXPORT_FILE_WRITE_FAILED', error)
  }
}

async function hashBlob(blob: Blob): Promise<string> {
  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      await blob.arrayBuffer()
    )
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  } catch (error) {
    throw createLocalAppError('EXPORT_FILE_WRITE_FAILED', error)
  }
}
