import assert from 'node:assert/strict'
import test from 'node:test'
import { createProgram } from '../cli/create-program.js'
import { runCli } from '../cli/run.js'
import { TodoUseCases } from '../application/todo-use-cases.js'
import type { TodoApiClient } from '../application/ports/todo-api-client.js'
import { loadConfig } from '../infrastructure/config.js'
import { createHttpClient } from '../infrastructure/http-client.js'
import type { Todo } from '../types/todo.js'

const todo: Todo = {
  id: 1,
  title: 'Prepare training',
  status: 'TODO',
  createdAt: '2026-08-26T00:00:00Z',
  updatedAt: '2026-08-26T00:00:00Z',
}

function fakeApi(overrides: Partial<TodoApiClient> = {}): TodoApiClient {
  return {
    listTodos: async () => [],
    createTodo: async () => todo,
    ...overrides,
  }
}

test('loads the default API URL and supports an environment override', () => {
  assert.equal(loadConfig({}).apiBaseUrl, 'http://localhost:18080')
  assert.equal(loadConfig({ TODO_API_URL: 'http://localhost:19090' }).apiBaseUrl, 'http://localhost:19090')
})

test('trims titles and rejects blank titles in the application layer', async () => {
  let input: { title: string } | undefined
  const app = new TodoUseCases(fakeApi({
    createTodo: async (value) => {
      input = value
      return todo
    },
  }))

  await app.addTodo('  Prepare training  ')
  assert.deepEqual(input, { title: 'Prepare training' })
  await assert.rejects(() => app.addTodo('   '), { message: 'Todo title is required' })
})

test('root and command help do not call the API', async () => {
  let calls = 0
  const app = new TodoUseCases(fakeApi({
    listTodos: async () => {
      calls += 1
      return []
    },
  }))
  const program = createProgram(app, '1.2.3')
  const output: string[] = []
  program.configureOutput({ writeOut: (value) => output.push(value) })

  await runCli(program, ['node', 'todo-cli', '--help'], () => undefined)
  assert.equal(calls, 0)
  assert.match(output.join(''), /Usage: todo-cli/)
  assert.match(output.join(''), /Examples:/)

  const addProgram = createProgram(app)
  const addOutput: string[] = []
  addProgram.configureOutput({ writeOut: (value) => addOutput.push(value) })
  await runCli(addProgram, ['node', 'todo-cli', 'add', '--help'], () => undefined)
  assert.equal(calls, 0)
  assert.match(addOutput.join(''), /todo title/)
})

test('HTTP client exposes response errors with status', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('not found', { status: 404 })

  try {
    await assert.rejects(
      () => createHttpClient('http://localhost').request('/api/todos'),
      (error: unknown) => error instanceof Error && error.message === 'not found' && 'status' in error && error.status === 404,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
