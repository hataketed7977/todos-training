import assert from 'node:assert/strict'
import test from 'node:test'
import type { Command } from 'commander'
import { createProgram } from '../cli/create-program.js'
import { runCli } from '../cli/run.js'
import type { FetchLike } from '../services/apiClient.js'
import { registerCreateCommand } from '../cli/commands/create.js'

function makeProgramWithFetch(fetchImpl: FetchLike) {
  const program = createProgram()
  ;(program.commands as Command[]).splice(0, program.commands.length)
  registerCreateCommand(program, { fetchImpl })
  return program
}

test('create command outputs created todo with all fields', async () => {
  process.exitCode = 0
  let capturedInit: { method?: string; headers?: Record<string, string>; body?: string } | undefined
  let capturedUrl = ''
  const fetchImpl: FetchLike = async (input, init) => {
    capturedUrl = String(input)
    capturedInit = init
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 42,
        title: '新任务',
        status: 'TODO',
        priority: 'HIGH',
        description: '任务描述',
        createdAt: '2026-08-29T10:00:00Z',
        updatedAt: '2026-08-29T10:00:00Z',
      }),
    }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({
    writeOut: s => out.push(s),
    writeErr: s => err.push(s),
  })

  await runCli(program, ['node', 'todos-cli', 'create', '新任务', '-d', '任务描述', '-p', 'HIGH'], m => err.push(m))
  const output = out.join('')
  assert.match(output, /Todo created successfully/)
  assert.match(output, /ID:\s+42/)
  assert.match(output, /Title:\s+新任务/)
  assert.match(output, /Status:\s+TODO/)
  assert.match(output, /Priority:\s+HIGH/)
  assert.match(output, /Description:\s+任务描述/)
  assert.match(output, /Created At:\s+2026-08-29T10:00:00Z/)
  assert.equal(err.length, 0)
  assert.equal(process.exitCode, 0)

  assert.equal(capturedUrl, 'http://localhost:18080/api/todos')
  assert.equal(capturedInit?.method, 'POST')
  assert.equal(capturedInit?.headers?.['Content-Type'], 'application/json')
  assert.equal(capturedInit?.headers?.['Accept'], 'application/json')
  assert.deepEqual(JSON.parse(capturedInit?.body ?? '{}'), {
    title: '新任务',
    description: '任务描述',
    priority: 'HIGH',
  })
})

test('create command works with only title and omits optional fields in payload', async () => {
  process.exitCode = 0
  let capturedBody = ''
  const fetchImpl: FetchLike = async (_input, init) => {
    capturedBody = init?.body ?? ''
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 7,
        title: 'Minimal',
        status: 'TODO',
        priority: null,
        description: null,
        createdAt: '2026-08-29T11:00:00Z',
        updatedAt: '2026-08-29T11:00:00Z',
      }),
    }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create', 'Minimal'], m => err.push(m))
  const output = out.join('')
  assert.match(output, /ID:\s+7/)
  assert.match(output, /Priority:\s+-/)
  assert.match(output, /Description:\s+-/)
  assert.equal(process.exitCode, 0)
  assert.deepEqual(JSON.parse(capturedBody), { title: 'Minimal' })
})

test('create command reports 400 validation failure and sets exitCode 1', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ message: 'title must not be blank' }),
  })
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create', '  '], m => err.push(m))
  assert.match(err.join(''), /Create failed with status 400.*title must not be blank/)
  assert.equal(process.exitCode, 1)
})

test('create command reports network error and sets exitCode 1', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => {
    throw new Error('ECONNREFUSED')
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create', 'x'], m => err.push(m))
  assert.match(err.join(''), /Failed to reach API/)
  assert.equal(process.exitCode, 1)
})

test('create command rejects invalid priority without calling API', async () => {
  process.exitCode = 0
  let called = false
  const fetchImpl: FetchLike = async () => {
    called = true
    return { ok: true, status: 201, json: async () => ({ id: 1 }) }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create', 'x', '-p', 'INVALID'], m => err.push(m))
  assert.match(err.join(''), /Invalid priority.*INVALID.*LOW, MEDIUM, HIGH/)
  assert.equal(process.exitCode, 1)
  assert.equal(called, false)
})

test('create command errors when title is missing', async () => {
  process.exitCode = 0
  const program = createProgram()
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create'], m => err.push(m))
  assert.notEqual(process.exitCode, 0, 'missing title should produce non-zero exitCode')
  assert.ok(err.length > 0, 'missing title should produce error output')
})

test('create command respects custom --api-url and uppercases priority', async () => {
  process.exitCode = 0
  let capturedUrl = ''
  let capturedBody = ''
  const fetchImpl: FetchLike = async (input, init) => {
    capturedUrl = String(input)
    capturedBody = init?.body ?? ''
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 99,
        title: 'remote',
        status: 'TODO',
        priority: 'MEDIUM',
        description: null,
        assignee: null,
        createdAt: '2026-08-29T12:00:00Z',
        updatedAt: '2026-08-29T12:00:00Z',
      }),
    }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', '--api-url', 'http://example.com:7777', 'create', 'remote', '-p', 'medium'], m => err.push(m))
  assert.equal(capturedUrl, 'http://example.com:7777/api/todos')
  const payload = JSON.parse(capturedBody)
  assert.equal(payload.title, 'remote')
  assert.equal(payload.priority, 'MEDIUM')
  assert.equal('description' in payload, false)
  assert.equal(process.exitCode, 0)
})

// ===== assignee 新增用例（TDD RED-GREEN）=====
// 预期 RED：未实现前，Todo 接口/ create.ts 不支持 assignee，导致 TS 编译失败或断言不匹配。

test('assignee: create with -a flag includes assignee in POST body', async () => {
  process.exitCode = 0
  let capturedBody = ''
  let capturedAssignee: unknown = undefined
  const fetchImpl: FetchLike = async (_input, init) => {
    capturedBody = init?.body ?? ''
    const parsed = JSON.parse(capturedBody)
    capturedAssignee = parsed.assignee
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 1,
        title: '任务X',
        status: 'TODO',
        priority: null,
        description: null,
        assignee: '张三',
        createdAt: '2026-08-30T00:00:00Z',
        updatedAt: '2026-08-30T00:00:00Z',
      }),
    }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create', '任务X', '-a', '张三'], m => err.push(m))
  assert.equal(capturedAssignee, '张三', 'POST body 必须携带 assignee 键值')
  assert.match(out.join(''), /Assignee:\s+张三/)
  assert.equal(process.exitCode, 0)
})

test('assignee: create without -a omits assignee key in body', async () => {
  process.exitCode = 0
  let capturedBody = ''
  const fetchImpl: FetchLike = async (_input, init) => {
    capturedBody = init?.body ?? ''
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 2,
        title: 'Minimal',
        status: 'TODO',
        priority: null,
        description: null,
        assignee: null,
        createdAt: '2026-08-30T00:00:00Z',
        updatedAt: '2026-08-30T00:00:00Z',
      }),
    }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'create', 'Minimal'], m => err.push(m))
  const payload = JSON.parse(capturedBody)
  assert.equal('assignee' in payload, false, '未提供 -a 时 POST body 中 assignee 键必须省略')
  assert.match(out.join(''), /Assignee:\s+-/)
  assert.equal(process.exitCode, 0)
})

test('assignee: apiClient.createTodo returned Todo carries assignee string', async () => {
  process.exitCode = 0
  let capturedAssignee: unknown = undefined
  const fetchImpl: FetchLike = async (_input, init) => {
    const parsed: Record<string, unknown> = JSON.parse((init?.body as string) ?? '{}')
    capturedAssignee = parsed.assignee
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 3,
        title: typeof parsed.title === 'string' ? parsed.title : 'fallback',
        status: 'TODO',
        priority: null,
        description: null,
        assignee: '李四',
        createdAt: '2026-08-30T00:00:00Z',
        updatedAt: '2026-08-30T00:00:00Z',
      }),
    }
  }
  const { createTodo } = await import('../services/apiClient.js')
  const t = await createTodo({
    apiUrl: 'http://localhost:9',
    title: 'api-client-test',
    assignee: '李四',
    fetchImpl,
  })
  assert.equal(t.assignee, '李四')
  assert.equal(capturedAssignee, '李四')
})

test('assignee: apiClient.fetchTodosByTitle returns each todo.assignee correctly', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 10, title: 'A', status: 'TODO', priority: null, description: null, assignee: '王五', createdAt: '', updatedAt: '' },
      { id: 11, title: 'B', status: 'TODO', priority: null, description: null, assignee: null, createdAt: '', updatedAt: '' },
    ],
  })
  const { fetchTodosByTitle } = await import('../services/apiClient.js')
  const list = await fetchTodosByTitle({ apiUrl: 'http://localhost:9', title: 'any', fetchImpl })
  assert.equal(list[0].assignee, '王五')
  assert.equal(list[1].assignee, null)
})
