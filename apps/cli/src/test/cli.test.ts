import assert from 'node:assert/strict'
import test from 'node:test'
import { createProgram } from '../cli/create-program.js'
import { runCli } from '../cli/run.js'

test('the CLI base exposes help with registered search command', async () => {
  const program = createProgram()
  const output: string[] = []
  program.configureOutput({ writeOut: (value) => output.push(value) })

  await runCli(program, ['node', 'todos-cli', '--help'], () => undefined)
  assert.match(output.join(''), /Usage: todos-cli/)
  assert.ok(program.commands.length >= 1)
  assert.equal(program.commands[0].name(), 'search')
  assert.match(output.join(''), /search.*按标题搜索 todos/)
})
