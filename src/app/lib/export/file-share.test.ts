import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shareExcelBlob } from './file-share'

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: vi.fn(),
  },
}))

vi.mock('@capacitor/share', () => ({
  Share: {
    canShare: vi.fn(),
    share: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Share.canShare).mockResolvedValue({ value: true })
  vi.mocked(Filesystem.writeFile).mockResolvedValue({
    uri: 'file:///cache/export.xlsx',
  })
  vi.mocked(Share.share).mockResolvedValue({})
})

describe('shareExcelBlob', () => {
  it('writes the xlsx blob to Cache as base64 and shares the file uri', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 255])])

    const result = await shareExcelBlob({
      blob,
      fileName: '示例数据中心01-A机房-20260102-030405.xlsx',
    })

    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: '示例数据中心01-A机房-20260102-030405.xlsx',
      data: 'AAEC/w==',
      directory: Directory.Cache,
    })
    expect(Share.share).toHaveBeenCalledWith({
      files: ['file:///cache/export.xlsx'],
    })
    expect(result).toMatchObject({
      fileUri: 'file:///cache/export.xlsx',
      fileSize: 4,
    })
    expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('fails with SHARE_UNAVAILABLE when the platform cannot share', async () => {
    vi.mocked(Share.canShare).mockResolvedValueOnce({ value: false })

    await expect(
      shareExcelBlob({ blob: new Blob(['xlsx']), fileName: 'export.xlsx' })
    ).rejects.toMatchObject({ code: 'SHARE_UNAVAILABLE' })
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
    expect(Share.share).not.toHaveBeenCalled()
  })
})
