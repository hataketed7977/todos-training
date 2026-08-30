import type { Command } from 'commander'
import {
  ERROR_CODES,
  fetchTodosByTitle,
  type FetchLike,
} from '../../services/apiClient.js'

export interface RegisterSearchOptions {
  fetchImpl?: FetchLike
}

const CLI_ERROR_CODES = {
  INVALID_API_URL: 'INVALID_API_URL',
} as const
type CliErrorCode = typeof CLI_ERROR_CODES[keyof typeof CLI_ERROR_CODES]

interface CliCodedError extends Error {
  code: CliErrorCode
}

function makeCliError(code: CliErrorCode, message: string): CliCodedError {
  const err = new Error(message) as CliCodedError
  err.code = code
  return err
}

function outputChannel(root: Command): {
  writeOut: (s: string) => void
  writeErr: (s: string) => void
} {
  // NOTE: _outputConfiguration is Commander's internal private property.
  // Reading it here lets action code reuse the writeOut/writeErr configured
  // via program.configureOutput(...) (used by tests to capture output).
  // If a future Commander version changes the private shape, update this
  // reader; the public fallback remains process.stdout/stderr.
  const cfg = (root as unknown as { _outputConfiguration?: {
    writeOut?: (s: string) => void
    writeErr?: (s: string) => void
  } })._outputConfiguration
  return {
    writeOut: cfg?.writeOut ?? ((s: string) => process.stdout.write(s)),
    writeErr: cfg?.writeErr ?? ((s: string) => process.stderr.write(s)),
  }
}

function isCodedError(err: unknown): err is { code: string; message: string } {
  return (
    err instanceof Error &&
    typeof (err as { code?: unknown }).code === 'string'
  )
}

export function registerSearchCommand(program: Command, options: RegisterSearchOptions = {}): void {
  program
    .command('search')
    .argument('<keyword>', '标题关键词')
    .description('按标题搜索 todos')
    .action(async (keyword: string) => {
      const rawApiUrl = program.getOptionValue('apiUrl')
      const { writeOut, writeErr } = outputChannel(program)

      try {
        if (typeof rawApiUrl !== 'string' || rawApiUrl.trim() === '') {
          throw makeCliError(CLI_ERROR_CODES.INVALID_API_URL, 'Invalid or missing --api-url')
        }
        const apiUrl: string = rawApiUrl

        const todos = await fetchTodosByTitle({
          apiUrl,
          title: keyword,
          fetchImpl: options.fetchImpl,
        })

        if (todos.length === 0) {
          writeOut('No todos found.\n')
          return
        }

        const rows = todos.map(t => ({
          id: String(t.id),
          status: t.status,
          priority: t.priority ?? '-',
          assignee: t.assignee ?? '-',
          title: t.title,
        }))
        const idW = Math.max('ID'.length, ...rows.map(r => r.id.length))
        const stW = Math.max('STATUS'.length, ...rows.map(r => r.status.length))
        const prW = Math.max('PRIORITY'.length, ...rows.map(r => r.priority.length))
        const asW = Math.max('ASSIGNEE'.length, ...rows.map(r => r.assignee.length))
        const tiW = Math.max('TITLE'.length, ...rows.map(r => r.title.length))

        writeOut(`Found ${todos.length} todo(s)\n`)
        writeOut('\n')
        writeOut(`${'ID'.padEnd(idW)} ${'STATUS'.padEnd(stW)} ${'PRIORITY'.padEnd(prW)} ${'ASSIGNEE'.padEnd(asW)} ${'TITLE'.padEnd(tiW)}\n`)
        writeOut(`${''.padEnd(idW, '-')} ${''.padEnd(stW, '-')} ${''.padEnd(prW, '-')} ${''.padEnd(asW, '-')} ${''.padEnd(tiW, '-')}\n`)
        for (const r of rows) {
          writeOut(`${r.id.padEnd(idW)} ${r.status.padEnd(stW)} ${r.priority.padEnd(prW)} ${r.assignee.padEnd(asW)} ${r.title.padEnd(tiW)}\n`)
        }
      } catch (err: unknown) {
        if (isCodedError(err)) {
          switch (err.code) {
            case CLI_ERROR_CODES.INVALID_API_URL:
            case ERROR_CODES.SEARCH_HTTP_ERROR:
            case ERROR_CODES.PARSE_ERROR:
              writeErr(`${err.message}\n`)
              break
            default:
              writeErr(`Failed to reach API: ${err.message}\n`)
          }
        } else {
          const message = err instanceof Error ? err.message : String(err)
          writeErr(`Failed to reach API: ${message}\n`)
        }
        process.exitCode = 1
      }
    })
}
