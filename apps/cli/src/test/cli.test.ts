import assert from 'node:assert/strict'
import test from 'node:test'
import { createProgram } from '../cli/create-program.js'
import { runCli } from '../cli/run.js'

test('the CLI base exposes help with registered create and search commands', async () => {
  const program = createProgram()
  const output: string[] = []
  program.configureOutput({ writeOut: (value) => output.push(value) })

  await runCli(program, ['node', 'todos-cli', '--help'], () => undefined)
  const joined = output.join('')
  assert.match(joined, /Usage: todos-cli/)
  assert.ok(program.commands.length >= 2)
  const names = program.commands.map(c => c.name())
  assert.ok(names.includes('create'), `expected commands to include 'create', got ${names}`)
  assert.ok(names.includes('search'), `expected commands to include 'search', got ${names}`)
  assert.match(joined, /create.*创建新 todo/)
  assert.match(joined, /search.*按标题搜索 todos/)
})
