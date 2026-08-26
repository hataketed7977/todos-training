import type { Command } from 'commander'
import type { TodoUseCases } from '../application/todo-use-cases.js'
import { printTodos } from '../output/todo-printer.js'

export function registerListCommand(program: Command, app: TodoUseCases) {
  program
    .command('list')
    .description('List todos')
    .action(async () => {
      const todos = await app.listTodos()
      if (todos.length === 0) {
        console.log('No todos found.')
        return
      }
      printTodos(todos)
    })
}
