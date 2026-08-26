import type { Command } from 'commander'
import type { TodoUseCases } from '../application/todo-use-cases.js'
import { printTodos } from '../output/todo-printer.js'

export function registerAddCommand(program: Command, app: TodoUseCases) {
  program
    .command('add')
    .description('Add a todo')
    .argument('<title>', 'todo title')
    .addHelpText('after', '\nExamples:\n  $ todo-cli add "Prepare training"\n')
    .action(async (title: string) => {
      const todo = await app.addTodo(title)
      printTodos([todo])
    })
}
