import type {
  LocalScanBatchDetail,
  LocalScanItem,
} from '@app/lib/local-db/types'
import { createLocalAppError, isLocalAppError } from '@app/lib/local-errors'
import writeExcelFile, {
  type CellObject,
  type Sheet,
  type SheetData,
} from 'write-excel-file/browser'

const localValidationNotice = '仅本地校验，未中心校验'

export interface ScanWorkbook {
  sheets: Sheet<Blob | File | ArrayBuffer>[]
  scanDetailRows: SheetData
  extendedConfigRows: SheetData
}

export function buildScanWorkbookRows(
  batch: LocalScanBatchDetail
): ScanWorkbook {
  const scanDetailRows: SheetData = [
    detailHeaderRow(),
    ...batch.items.map((item) => detailRow(batch, item)),
  ]
  const extendedConfigRows: SheetData = [
    configHeaderRow(),
    ...batchConfigRows(batch),
    ...batch.items.flatMap((item) => itemConfigRows(batch.batchNo, item)),
  ]

  return {
    scanDetailRows,
    extendedConfigRows,
    sheets: [
      {
        sheet: '扫描明细',
        data: scanDetailRows,
        stickyRowsCount: 1,
      },
      {
        sheet: '扩展配置',
        data: extendedConfigRows,
        stickyRowsCount: 1,
      },
    ],
  }
}

export async function exportBatchToExcel(
  batch: LocalScanBatchDetail
): Promise<Blob> {
  try {
    const workbook = buildScanWorkbookRows(batch)
    return await writeExcelFile(workbook.sheets).toBlob()
  } catch (error) {
    if (isLocalAppError(error)) throw error
    throw createLocalAppError('EXPORT_EXCEL_FAILED', error)
  }
}

function detailHeaderRow(): SheetData[number] {
  return [
    headerCell('批次号'),
    headerCell('到货批次 / 项目名'),
    headerCell('操作人姓名'),
    headerCell('数据中心'),
    headerCell('机房'),
    headerCell('机柜'),
    headerCell('U 位'),
    headerCell('SN'),
    headerCell('原始扫码值'),
    headerCell('条码格式'),
    headerCell('扫描时间'),
    headerCell('设备类型 / 机器配置摘要'),
    headerCell('配置备注'),
    headerCell('是否单台覆盖配置'),
    headerCell('校验状态'),
  ]
}

function detailRow(
  batch: LocalScanBatchDetail,
  item: LocalScanItem
): SheetData[number] {
  const hasOverride = hasItemConfigOverride(item)

  return [
    textCell(batch.batchNo),
    textCell(batch.arrivalBatchName),
    textCell(batch.operatorName),
    textCell(batch.dataCenterName),
    textCell(batch.roomName),
    textCell(item.rackName || item.rackId),
    textCell(item.uPosition === null ? '' : String(item.uPosition)),
    textCell(item.serialNumber),
    textCell(item.rawValue),
    textCell(item.barcodeFormat),
    textCell(item.scannedAt),
    textCell(batch.machineConfigSummary),
    textCell(hasOverride ? item.configNoteOverride : batch.defaultConfigNote),
    textCell(hasOverride ? '是' : '否'),
    textCell(localValidationNotice),
  ]
}

function configHeaderRow(): SheetData[number] {
  return [
    headerCell('批次号'),
    headerCell('SN'),
    headerCell('字段名'),
    headerCell('字段值'),
    headerCell('来源：批次默认 / 单台覆盖'),
  ]
}

function batchConfigRows(batch: LocalScanBatchDetail): SheetData[number][] {
  const rows: SheetData[number][] = []

  if (batch.defaultConfigNote.trim().length > 0) {
    rows.push(
      configRow(batch.batchNo, '', '配置备注', batch.defaultConfigNote, '批次默认')
    )
  }

  for (const attribute of batch.attributes) {
    rows.push(
      configRow(batch.batchNo, '', attribute.key, attribute.value, '批次默认')
    )
  }

  return rows
}

function itemConfigRows(
  batchNo: string,
  item: LocalScanItem
): SheetData[number][] {
  const rows: SheetData[number][] = []

  if (
    hasItemConfigOverride(item) &&
    item.configNoteOverride.trim().length > 0
  ) {
    rows.push(
      configRow(
        batchNo,
        item.serialNumber,
        '配置备注',
        item.configNoteOverride,
        '单台覆盖'
      )
    )
  }

  for (const attribute of item.attributes) {
    rows.push(
      configRow(
        batchNo,
        item.serialNumber,
        attribute.key,
        attribute.value,
        '单台覆盖'
      )
    )
  }

  return rows
}

function hasItemConfigOverride(item: LocalScanItem): boolean {
  return (
    item.hasConfigOverride ||
    item.configNoteOverride.trim().length > 0 ||
    item.attributes.length > 0
  )
}

function configRow(
  batchNo: string,
  serialNumber: string,
  key: string,
  value: string,
  source: string
): SheetData[number] {
  return [
    textCell(batchNo),
    textCell(serialNumber),
    textCell(key),
    textCell(value),
    textCell(source),
  ]
}

function headerCell(value: string): CellObject {
  return {
    value,
    type: String,
    fontWeight: 'bold',
  }
}

function textCell(value: string): CellObject {
  return {
    value,
    type: String,
  }
}
