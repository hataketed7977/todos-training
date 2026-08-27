import { Command } from 'commander'

export function createProgram(): Command {
  const program = new Command()

  program
    .name('todos-cli')
    .description('Todos CLI foundation')
    .showHelpAfterError()
    .configureHelp({
      sortOptions: true,
    })

  return program
}
