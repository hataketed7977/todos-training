import assert from 'node:assert/strict'
import test from 'node:test'
import { createProgram } from '../cli/create-program.js'
import { runCli } from '../cli/run.js'

test('the CLI base exposes help without business commands', async () => {
  const program = createProgram()
  const output: string[] = []
  program.configureOutput({ writeOut: (value) => output.push(value) })

  await runCli(program, ['node', 'todos-cli', '--help'], () => undefined)
  assert.match(output.join(''), /Usage: todos-cli/)
  assert.equal(program.commands.length, 0)
  assert.doesNotMatch(output.join(''), /list|add/)
})
