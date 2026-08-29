import type { Command } from 'commander'
import {
  createTodo,
  ERROR_CODES,
  type CodedError,
  type FetchLike,
  type Priority,
  VALID_PRIORITIES,
} from '../../services/apiClient.js'

export interface RegisterCreateOptions {
  fetchImpl?: FetchLike
}

const CLI_ERROR_CODES = {
  INVALID_API_URL: 'INVALID_API_URL',
  INVALID_PRIORITY: 'INVALID_PRIORITY',
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

export function registerCreateCommand(program: Command, options: RegisterCreateOptions = {}): void {
  program
    .command('create')
    .argument('<title>', '任务标题')
    .description('创建新 todo')
    .option('-d, --description <text>', '任务描述')
    .option('-p, --priority <level>', `优先级：LOW | MEDIUM | HIGH（大小写均可）`)
    .action(async (title: string, opts: { description?: string; priority?: string }) => {
      const rawApiUrl = program.getOptionValue('apiUrl')
      const { writeOut, writeErr } = outputChannel(program)

      try {
        if (typeof rawApiUrl !== 'string' || rawApiUrl.trim() === '') {
          throw makeCliError(CLI_ERROR_CODES.INVALID_API_URL, 'Invalid or missing --api-url')
        }
        const apiUrl: string = rawApiUrl

        let priority: Priority | undefined
        if (opts.priority !== undefined) {
          const upper = opts.priority.toUpperCase()
          if (!VALID_PRIORITIES.has(upper)) {
            throw makeCliError(
              CLI_ERROR_CODES.INVALID_PRIORITY,
              `Invalid priority: ${opts.priority}. Must be one of: LOW, MEDIUM, HIGH`
            )
          }
          priority = upper as Priority
        }

        const todo = await createTodo({
          apiUrl,
          title,
          description: opts.description,
          priority,
          fetchImpl: options.fetchImpl,
        })

        writeOut(`Todo created successfully:\n`)
        writeOut(`  ID:          ${todo.id}\n`)
        writeOut(`  Title:       ${todo.title}\n`)
        writeOut(`  Status:      ${todo.status}\n`)
        writeOut(`  Priority:    ${todo.priority ?? '-'}\n`)
        writeOut(`  Description: ${todo.description ?? '-'}\n`)
        writeOut(`  Created At:  ${todo.createdAt}\n`)
      } catch (err: unknown) {
        if (isCodedError(err)) {
          switch (err.code) {
            case CLI_ERROR_CODES.INVALID_API_URL:
            case CLI_ERROR_CODES.INVALID_PRIORITY:
              writeErr(`${err.message}\n`)
              break
            case ERROR_CODES.CREATE_HTTP_ERROR:
              writeErr(`${err.message}\n`)
              break
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
