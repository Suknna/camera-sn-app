import { describe, expect, it } from 'vitest'
import {
  createLocalAppError,
  isLocalAppError,
  localAppErrorCodes,
  localErrorMessage,
  localErrorTitle,
  type LocalAppErrorCode,
} from './local-errors'

const expectedMessages = {
  LOCAL_DB_UNAVAILABLE:
    '本地数据库暂时不可用，请重启 App 后重试；如果仍失败，请导出日志交给维护人员。',
  CATALOG_SEED_INVALID:
    'App 内置机房目录配置有误，请重新安装正确构建的 App。',
  OPERATOR_NAME_REQUIRED: '请填写操作人姓名。',
  BATCH_REQUIRED_FIELDS_MISSING: '请补全批次必填信息后再继续。',
  SCAN_ITEM_DUPLICATE_IN_BATCH:
    '这台设备的 SN 已在当前批次中记录，请勿重复扫描。',
  SCAN_ITEM_DUPLICATE_LOCAL_HISTORY:
    '本机历史记录中出现过这个 SN，请确认是否重复入库。',
  BATCH_NOT_COMPLETED: '请先完成批次，再导出 Excel。',
  EXPORT_EXCEL_FAILED: 'Excel 文件生成失败，请稍后重试。',
  EXPORT_FILE_WRITE_FAILED: '文件保存失败，请检查手机存储空间后重试。',
  SHARE_UNAVAILABLE: '当前设备不支持系统分享，请先导出文件后手动发送。',
  SHARE_FAILED: '分享未完成，请重新选择分享应用。',
} as const satisfies Record<LocalAppErrorCode, string>

describe('local app errors', () => {
  it('uses the exact local error codes from the standalone App spec', () => {
    expect(localAppErrorCodes).toEqual([
      'LOCAL_DB_UNAVAILABLE',
      'CATALOG_SEED_INVALID',
      'OPERATOR_NAME_REQUIRED',
      'BATCH_REQUIRED_FIELDS_MISSING',
      'SCAN_ITEM_DUPLICATE_IN_BATCH',
      'SCAN_ITEM_DUPLICATE_LOCAL_HISTORY',
      'BATCH_NOT_COMPLETED',
      'EXPORT_EXCEL_FAILED',
      'EXPORT_FILE_WRITE_FAILED',
      'SHARE_UNAVAILABLE',
      'SHARE_FAILED',
    ])
  })

  it('uses the approved Chinese user-facing messages from the spec', () => {
    for (const code of localAppErrorCodes) {
      expect(localErrorMessage(code)).toBe(expectedMessages[code])
    }
  })

  it('maps every local error code to safe user-facing text', () => {
    for (const code of localAppErrorCodes) {
      const title = localErrorTitle(code)
      const message = localErrorMessage(code)

      expect(title).not.toBe('')
      expect(message).not.toBe('')
      expect(message).not.toBe(code)
      expect(message).not.toContain('_')
      expect(title).not.toBe(code)
      expect(title).not.toContain('_')
    }
  })

  it('stores internal codes while exposing Chinese user-facing messages', () => {
    for (const code of localAppErrorCodes) {
      const cause = new Error('internal detail')
      const error = createLocalAppError(code, cause)

      expect(error.code).toBe(code)
      expect(error.message).toBe(localErrorMessage(code))
      expect(error.message).not.toContain(code)
      expect(error.message).not.toContain('_')
      expect(error.cause).toBe(cause)
    }
  })

  it('recognizes local app errors only', () => {
    expect(isLocalAppError(createLocalAppError('LOCAL_DB_UNAVAILABLE'))).toBe(true)
    expect(isLocalAppError(new Error('plain error'))).toBe(false)
  })
})
