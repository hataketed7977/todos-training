import { Command } from 'commander'
import type { TodoUseCases } from '../application/todo-use-cases.js'
import { registerAddCommand } from '../commands/add.js'
import { registerListCommand } from '../commands/list.js'

export function createProgram(app: TodoUseCases, version = '0.0.0'): Command {
  const program = new Command()

  program
    .name('todos-cli')
    .description('Manage todos through the training API')
    .version(version)
    .showHelpAfterError()
    .configureHelp({
      sortSubcommands: true,
      sortOptions: true,
    })
    .addHelpText('after', '\nExamples:\n  $ todos-cli list\n  $ todos-cli add "Prepare training"\n')

  registerListCommand(program, app)
  registerAddCommand(program, app)

  return program
}
