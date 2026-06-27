import type { LocalScanBatchDetail } from '@app/lib/local-db/types'
import { describe, expect, it } from 'vitest'
import type { CellObject, SheetData } from 'write-excel-file/browser'
import { buildScanWorkbookRows, exportBatchToExcel } from './excel-exporter'

describe('buildScanWorkbookRows', () => {
  it('builds the approved sheet names and scan detail columns', () => {
    const workbook = buildScanWorkbookRows(makeBatch())

    expect(workbook.sheets.map((sheet) => sheet.sheet)).toEqual([
      '扫描明细',
      '扩展配置',
    ])
    expect(rowValues(workbook.scanDetailRows[0]!)).toEqual([
      '批次号',
      '到货批次 / 项目名',
      '操作人姓名',
      '数据中心',
      '机房',
      '机柜',
      'U 位',
      'SN',
      '原始扫码值',
      '条码格式',
      '扫描时间',
      '设备类型 / 机器配置摘要',
      '配置备注',
      '是否单台覆盖配置',
      '校验状态',
    ])
    expect(rowValues(workbook.extendedConfigRows[0]!)).toEqual([
      '批次号',
      'SN',
      '字段名',
      '字段值',
      '来源：批次默认 / 单台覆盖',
    ])
  })

  it('keeps SN, raw value, rack, U position and batch numbers as text cells', () => {
    const workbook = buildScanWorkbookRows(makeBatch())
    const detailRow = workbook.scanDetailRows[1]!

    expect(textCell(detailRow, '批次号')).toMatchObject({
      value: 'LOCAL-20260102030405-test',
      type: String,
    })
    expect(textCell(detailRow, '到货批次 / 项目名')).toMatchObject({
      value: '到货批次一',
      type: String,
    })
    expect(textCell(detailRow, 'SN')).toMatchObject({
      value: '0012345678',
      type: String,
    })
    expect(textCell(detailRow, '原始扫码值')).toMatchObject({
      value: ' 0012345678 ',
      type: String,
    })
    expect(textCell(detailRow, '机柜')).toMatchObject({
      value: 'A01',
      type: String,
    })
    expect(textCell(detailRow, 'U 位')).toMatchObject({
      value: '7',
      type: String,
    })
    expect(textCell(detailRow, '校验状态')).toMatchObject({
      value: '仅本地校验，未中心校验',
      type: String,
    })
    expect(textCell(detailRow, '配置备注')).toMatchObject({
      value: '现场更换内存',
      type: String,
    })
    expect(textCell(detailRow, '是否单台覆盖配置')).toMatchObject({
      value: '是',
      type: String,
    })
  })

  it('includes batch and item extended configuration rows', () => {
    const workbook = buildScanWorkbookRows(makeBatch())

    expect(workbook.extendedConfigRows.map(rowValues)).toContainEqual([
      'LOCAL-20260102030405-test',
      '',
      '电源',
      '双电',
      '批次默认',
    ])
    expect(workbook.extendedConfigRows.map(rowValues)).toContainEqual([
      'LOCAL-20260102030405-test',
      '',
      '配置备注',
      '默认配置备注',
      '批次默认',
    ])
    expect(workbook.extendedConfigRows.map(rowValues)).toContainEqual([
      'LOCAL-20260102030405-test',
      '0012345678',
      '配置备注',
      '现场更换内存',
      '单台覆盖',
    ])
    expect(workbook.extendedConfigRows.map(rowValues)).toContainEqual([
      'LOCAL-20260102030405-test',
      '0012345678',
      '资产标签',
      'asset-001',
      '单台覆盖',
    ])
  })
})

describe('exportBatchToExcel', () => {
  it('returns a non-empty xlsx blob', async () => {
    const blob = await exportBatchToExcel(makeBatch())

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})

function textCell(row: SheetData[number], header: string): CellObject {
  const headerIndex = rowValues(
    buildScanWorkbookRows(makeBatch()).scanDetailRows[0]!
  ).indexOf(header)
  return row[headerIndex] as CellObject
}

function rowValues(row: SheetData[number]): string[] {
  return row.map((cell) => {
    if (cell && typeof cell === 'object' && 'value' in cell) {
      return String(cell.value ?? '')
    }
    return String(cell ?? '')
  })
}

function makeBatch(): LocalScanBatchDetail {
  return {
    localBatchId: 'batch-local-001',
    clientBatchId: 'client-batch-001',
    batchNo: 'LOCAL-20260102030405-test',
    arrivalBatchName: '到货批次一',
    operatorName: '王工',
    dataCenterId: 'dc-demo-01',
    dataCenterName: '示例数据中心01',
    roomId: 'room-demo-a',
    roomName: 'A机房',
    machineConfigSummary: '2U 通用服务器 / 256G 内存',
    defaultConfigNote: '默认配置备注',
    status: 'completed',
    itemCount: 1,
    createdAt: '2026-01-02T03:04:00.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    completedAt: '2026-01-02T03:04:05.000Z',
    lastExportedAt: null,
    attributes: [
      { localAttributeId: 'batch-attr-1', key: '电源', value: '双电' },
    ],
    items: [
      {
        localItemId: 'item-local-1',
        clientItemId: 'item-client-1',
        rawValue: ' 0012345678 ',
        serialNumber: '0012345678',
        barcodeFormat: 'CODE_128',
        rackId: 'rack-a01',
        rackName: 'A01',
        uPosition: 7,
        scannedAt: '2026-01-02T03:04:05.000Z',
        configNoteOverride: '现场更换内存',
        hasConfigOverride: true,
        attributes: [
          {
            localAttributeId: 'item-attr-1',
            key: '资产标签',
            value: 'asset-001',
          },
        ],
      },
    ],
  }
}
