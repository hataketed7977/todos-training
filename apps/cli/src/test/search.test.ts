import assert from 'node:assert/strict'
import test from 'node:test'
import type { Command } from 'commander'
import { createProgram } from '../cli/create-program.js'
import { runCli } from '../cli/run.js'
import type { FetchLike } from '../services/apiClient.js'
import { registerSearchCommand } from '../cli/commands/search.js'

function makeProgramWithFetch(fetchImpl: FetchLike) {
  const program = createProgram()
  ;(program.commands as Command[]).splice(0, program.commands.length)
  registerSearchCommand(program, { fetchImpl })
  return program
}

test('search command outputs table for multiple results', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 1, title: '培训材料', status: 'TODO', priority: 'HIGH', description: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 2, title: '培训报告', status: 'DOING', priority: null, description: 'x', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    ],
  })
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({
    writeOut: s => out.push(s),
    writeErr: s => err.push(s),
  })

  await runCli(program, ['node', 'todos-cli', 'search', '培训'], m => err.push(m))
  const output = out.join('')
  assert.match(output, /Found 2 todo\(s\)/)
  assert.match(output, /\b1\b.*TODO.*HIGH.*培训材料/)
  assert.match(output, /\b2\b.*DOING.*-.*培训报告/)
  assert.equal(err.length, 0)
  assert.equal(process.exitCode, 0)
})

test('search command handles empty result', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => [],
  })
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'search', 'nothing'], m => err.push(m))
  assert.match(out.join(''), /No todos found\./)
  assert.equal(process.exitCode, 0)
})

test('search command reports network error and sets exitCode 1', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => {
    throw new Error('ECONNREFUSED')
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'search', 'anything'], m => err.push(m))
  assert.match(err.join(''), /Failed to reach API/)
  assert.equal(process.exitCode, 1)
})

test('search command reports non-2xx status and sets exitCode 1', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: 'Internal server error' }),
  })
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'search', 'anything'], m => err.push(m))
  assert.match(err.join(''), /Search failed with status 500/)
  assert.equal(process.exitCode, 1)
})

test('search command errors when keyword is missing', async () => {
  process.exitCode = 0
  const program = createProgram()
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'search'], m => err.push(m))
  assert.ok(process.exitCode !== 0 || err.length > 0, 'expected non-zero exit or error output when keyword missing')
})

test('search command respects custom --api-url and encodes title', async () => {
  process.exitCode = 0
  let capturedUrl = ''
  const fetchImpl: FetchLike = async (input) => {
    capturedUrl = String(input)
    return {
      ok: true,
      status: 200,
      json: async () => [],
    }
  }
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', '--api-url', 'http://example.com:9999', 'search', '培训 材料'], m => err.push(m))
  assert.equal(
    capturedUrl,
    'http://example.com:9999/api/todos?title=%E5%9F%B9%E8%AE%AD%20%E6%9D%90%E6%96%99'
  )
  assert.equal(process.exitCode, 0)
})

// ===== assignee 新增用例（TDD RED-GREEN）=====
// 预期 RED：search 表格列未加 ASSIGNEE，导致表格行不包含 assignee 显示值的正则匹配失败。

test('assignee: search table shows ASSIGNEE column with value when present', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 1, title: '任务X', status: 'TODO', priority: null, description: null, assignee: '张三', createdAt: '', updatedAt: '' },
    ],
  })
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'search', 'X'], m => err.push(m))
  const output = out.join('')
  // 表格必须包含 ASSIGNEE 表头，以及对应行的 "张三" 列值
  assert.match(output, /\bASSIGNEE\b/)
  assert.match(output, /\b1\b.*TODO.*-.*张三.*任务X/)
  assert.equal(process.exitCode, 0)
})

test('assignee: search table ASSIGNEE column renders hyphen when null', async () => {
  process.exitCode = 0
  const fetchImpl: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 1, title: '任务X', status: 'TODO', priority: 'HIGH', description: null, assignee: null, createdAt: '', updatedAt: '' },
    ],
  })
  const program = makeProgramWithFetch(fetchImpl)
  const out: string[] = []
  const err: string[] = []
  program.configureOutput({ writeOut: s => out.push(s), writeErr: s => err.push(s) })

  await runCli(program, ['node', 'todos-cli', 'search', 'X'], m => err.push(m))
  const output = out.join('')
  assert.match(output, /\b1\b.*TODO.*HIGH.*-.*任务X/)
  assert.equal(process.exitCode, 0)
})
