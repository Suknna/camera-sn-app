import { describe, expect, it } from 'vitest'
import { buildExportFileName } from './export-filename'

describe('buildExportFileName', () => {
  it('builds the approved local export filename format', () => {
    expect(
      buildExportFileName({
        dataCenterName: '示例数据中心01',
        roomName: 'A机房',
        exportedAt: new Date(2026, 0, 2, 3, 4, 5),
      })
    ).toBe('示例数据中心01-A机房-20260102-030405.xlsx')
  })

  it('sanitizes illegal filename characters without falling back to unknown', () => {
    expect(
      buildExportFileName({
        dataCenterName: ' 华东/DC::01 ',
        roomName: ' A<>机房?? ',
        exportedAt: new Date(2026, 5, 7, 8, 9, 10),
      })
    ).toBe('华东-DC-01-A-机房-20260607-080910.xlsx')
  })

  it('fails when the cleaned data center name is empty', () => {
    expectExportFileWriteFailure(() =>
      buildExportFileName({
        dataCenterName: '///***',
        roomName: 'A机房',
        exportedAt: new Date(2026, 0, 2, 3, 4, 5),
      })
    )
  })

  it('fails when the cleaned room name is empty', () => {
    expectExportFileWriteFailure(() =>
      buildExportFileName({
        dataCenterName: '示例数据中心01',
        roomName: ':::???',
        exportedAt: new Date(2026, 0, 2, 3, 4, 5),
      })
    )
  })
})

function expectExportFileWriteFailure(operation: () => void) {
  let thrown: unknown
  try {
    operation()
  } catch (error) {
    thrown = error
  }

  expect(thrown).toMatchObject({ code: 'EXPORT_FILE_WRITE_FAILED' })
}
