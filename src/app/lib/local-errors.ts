export const localAppErrorCodes = [
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
] as const

export type LocalAppErrorCode = (typeof localAppErrorCodes)[number]

const localErrorTitles = {
  LOCAL_DB_UNAVAILABLE: '本地数据库不可用',
  CATALOG_SEED_INVALID: '机房目录配置有误',
  OPERATOR_NAME_REQUIRED: '需要填写操作人姓名',
  BATCH_REQUIRED_FIELDS_MISSING: '批次信息不完整',
  SCAN_ITEM_DUPLICATE_IN_BATCH: '当前批次已记录该 SN',
  SCAN_ITEM_DUPLICATE_LOCAL_HISTORY: '本机历史已出现该 SN',
  BATCH_NOT_COMPLETED: '批次尚未完成',
  EXPORT_EXCEL_FAILED: 'Excel 生成失败',
  EXPORT_FILE_WRITE_FAILED: '文件保存失败',
  SHARE_UNAVAILABLE: '系统分享不可用',
  SHARE_FAILED: '分享未完成',
} as const satisfies Record<LocalAppErrorCode, string>

const localErrorMessages = {
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

export class LocalAppError extends Error {
  public readonly code: LocalAppErrorCode
  public readonly cause?: unknown

  constructor(code: LocalAppErrorCode, cause?: unknown) {
    super(localErrorMessage(code))
    this.name = 'LocalAppError'
    this.code = code
    this.cause = cause
    Object.setPrototypeOf(this, LocalAppError.prototype)
  }
}

export function createLocalAppError(
  code: LocalAppErrorCode,
  cause?: unknown
): LocalAppError {
  return new LocalAppError(code, cause)
}

export function isLocalAppError(error: unknown): error is LocalAppError {
  return error instanceof LocalAppError
}

export function localErrorTitle(code: LocalAppErrorCode): string {
  return localErrorTitles[code]
}

export function localErrorMessage(code: LocalAppErrorCode): string {
  return localErrorMessages[code]
}
