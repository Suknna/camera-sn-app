import { CapacitorSQLite } from '@capacitor-community/sqlite'
import { createLocalAppError } from '../local-errors'
import { LOCAL_DB_NAME, LOCAL_DB_VERSION } from './schema'
import {
  createLocalScanRepository,
  type LocalScanRepositoryOptions,
} from './repository'
import type { LocalScanRepository } from './types'

export type SQLiteValue = string | number | null
export type SQLiteRow = Record<string, unknown>

export interface LocalDBExecutor {
  execute(statements: string): Promise<void>
  run(statement: string, values?: SQLiteValue[]): Promise<void>
  query<Row extends SQLiteRow>(
    statement: string,
    values?: SQLiteValue[]
  ): Promise<Row[]>
  transaction<Result>(operation: (executor: LocalDBExecutor) => Promise<Result>): Promise<Result>
}

interface CapacitorSQLiteExecutorOptions {
  databaseName?: string
  version?: number
}

class CapacitorSQLiteExecutor implements LocalDBExecutor {
  private opened = false
  private readonly databaseName: string
  private readonly version: number

  constructor(options: CapacitorSQLiteExecutorOptions = {}) {
    this.databaseName = options.databaseName ?? LOCAL_DB_NAME
    this.version = options.version ?? LOCAL_DB_VERSION
  }

  async execute(statements: string): Promise<void> {
    await this.ensureOpen()
    await this.wrapNativeCall(() =>
      CapacitorSQLite.execute({
        database: this.databaseName,
        statements,
      })
    )
  }

  async run(statement: string, values: SQLiteValue[] = []): Promise<void> {
    await this.ensureOpen()
    await this.wrapNativeCall(() =>
      CapacitorSQLite.run({
        database: this.databaseName,
        statement,
        values,
      })
    )
  }

  async query<Row extends SQLiteRow>(
    statement: string,
    values: SQLiteValue[] = []
  ): Promise<Row[]> {
    await this.ensureOpen()
    const result = await this.wrapNativeCall(() =>
      CapacitorSQLite.query({
        database: this.databaseName,
        statement,
        values,
      })
    )

    return (result.values ?? []).filter(isSQLiteRow) as Row[]
  }

  async transaction<Result>(
    operation: (executor: LocalDBExecutor) => Promise<Result>
  ): Promise<Result> {
    await this.ensureOpen()
    await this.wrapNativeCall(() =>
      CapacitorSQLite.beginTransaction({ database: this.databaseName })
    )

    try {
      const result = await operation(this)
      await this.wrapNativeCall(() =>
        CapacitorSQLite.commitTransaction({ database: this.databaseName })
      )
      return result
    } catch (error) {
      await this.wrapNativeCall(() =>
        CapacitorSQLite.rollbackTransaction({ database: this.databaseName })
      )
      throw error
    }
  }

  private async ensureOpen(): Promise<void> {
    if (this.opened) return

    await this.wrapNativeCall(async () => {
      try {
        await CapacitorSQLite.createConnection({
          database: this.databaseName,
          encrypted: false,
          mode: 'no-encryption',
          version: this.version,
        })
      } catch (error) {
        if (!isExistingConnectionError(error)) throw error
      }
      await CapacitorSQLite.open({ database: this.databaseName })
      this.opened = true
    })
  }

  private async wrapNativeCall<Result>(
    operation: () => Promise<Result>
  ): Promise<Result> {
    try {
      return await operation()
    } catch (error) {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE', error)
    }
  }
}

function isSQLiteRow(value: unknown): value is SQLiteRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isExistingConnectionError(error: unknown): boolean {
  return error instanceof Error && /already|exist/i.test(error.message)
}

export function createCapacitorSQLiteExecutor(
  options: CapacitorSQLiteExecutorOptions = {}
): LocalDBExecutor {
  return new CapacitorSQLiteExecutor(options)
}

export function createSQLiteScanRepository(
  options: LocalScanRepositoryOptions = {}
): LocalScanRepository {
  return createLocalScanRepository(createCapacitorSQLiteExecutor(), options)
}
