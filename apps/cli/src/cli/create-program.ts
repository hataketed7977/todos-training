import { Command } from 'commander'
import { registerCreateCommand } from './commands/create.js'
import { registerSearchCommand } from './commands/search.js'

export function createProgram(): Command {
  const program = new Command()

  program
    .name('todos-cli')
    .description('Todos CLI foundation')
    .exitOverride()
    .showHelpAfterError()
    .configureHelp({
      sortOptions: true,
    })
    .option('--api-url <url>', 'API base URL', 'http://localhost:18080')

  registerCreateCommand(program)
  registerSearchCommand(program)

  return program
}
