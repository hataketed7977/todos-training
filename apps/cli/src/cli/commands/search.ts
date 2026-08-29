import type { Command } from 'commander'
import { fetchTodosByTitle, type FetchLike } from '../../services/apiClient.js'

export interface RegisterSearchOptions {
  fetchImpl?: FetchLike
}

function outputChannel(root: Command): {
  writeOut: (s: string) => void
  writeErr: (s: string) => void
} {
  const cfg = (root as unknown as { _outputConfiguration?: {
    writeOut?: (s: string) => void
    writeErr?: (s: string) => void
  } })._outputConfiguration
  return {
    writeOut: cfg?.writeOut ?? ((s: string) => process.stdout.write(s)),
    writeErr: cfg?.writeErr ?? ((s: string) => process.stderr.write(s)),
  }
}

export function registerSearchCommand(program: Command, options: RegisterSearchOptions = {}): void {
  program
    .command('search')
    .argument('<keyword>', '标题关键词')
    .description('按标题搜索 todos')
    .action(async (keyword: string) => {
      const apiUrl = program.getOptionValue('apiUrl') as string
      const { writeOut, writeErr } = outputChannel(program)

      try {
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
          title: t.title,
        }))
        const idW = Math.max('ID'.length, ...rows.map(r => r.id.length))
        const stW = Math.max('STATUS'.length, ...rows.map(r => r.status.length))
        const prW = Math.max('PRIORITY'.length, ...rows.map(r => r.priority.length))
        const tiW = Math.max('TITLE'.length, ...rows.map(r => r.title.length))

        writeOut(`Found ${todos.length} todo(s)\n`)
        writeOut('\n')
        writeOut(`${'ID'.padEnd(idW)} ${'STATUS'.padEnd(stW)} ${'PRIORITY'.padEnd(prW)} ${'TITLE'.padEnd(tiW)}\n`)
        writeOut(`${''.padEnd(idW, '-')} ${''.padEnd(stW, '-')} ${''.padEnd(prW, '-')} ${''.padEnd(tiW, '-')}\n`)
        for (const r of rows) {
          writeOut(`${r.id.padEnd(idW)} ${r.status.padEnd(stW)} ${r.priority.padEnd(prW)} ${r.title.padEnd(tiW)}\n`)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.startsWith('Search failed with status')) {
          writeErr(`${message}\n`)
        } else if (message === 'Failed to parse API response') {
          writeErr(`${message}\n`)
        } else {
          writeErr(`Failed to reach API: ${message}\n`)
        }
        process.exitCode = 1
      }
    })
}
