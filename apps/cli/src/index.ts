#!/usr/bin/env node
import { Command } from 'commander'
import {
  addTodo,
  deleteTodo,
  listTodos,
  moveTodo,
  Todo,
  TodoPriority,
  TodoStatus,
} from './api/todos.js'

const program = new Command()

program
  .name('todo')
  .description('Manage todos through the training API')
  .version('0.0.0')

program.command('list').description('List todos').action(run(async () => {
  const todos = await listTodos()
  if (todos.length === 0) {
    console.log('No todos found.')
    return
  }
  printTodos(todos)
}))

program
  .command('add')
  .description('Add a todo')
  .argument('<title>', 'todo title')
  .option('-d, --description <description>', 'todo description')
  .option('-p, --priority <priority>', 'LOW, MEDIUM, or HIGH', 'MEDIUM')
  .action(run(async (title: string, options: { description?: string; priority: string }) => {
    const todo = await addTodo({
      title,
      description: options.description,
      priority: normalizePriority(options.priority),
    })
    printTodos([todo])
  }))

program
  .command('move')
  .description('Move a todo to a status')
  .argument('<id>', 'todo id')
  .argument('<status>', 'TODO, DOING, or DONE')
  .action(run(async (id: string, status: string) => {
    const todo = await moveTodo(parseId(id), normalizeStatus(status))
    printTodos([todo])
  }))

program
  .command('done')
  .description('Mark a todo as done')
  .argument('<id>', 'todo id')
  .action(run(async (id: string) => {
    const todo = await moveTodo(parseId(id), 'DONE')
    printTodos([todo])
  }))

program
  .command('delete')
  .description('Delete a todo')
  .argument('<id>', 'todo id')
  .action(run(async (id: string) => {
    await deleteTodo(parseId(id))
    console.log(`Deleted todo ${id}.`)
  }))

program.parse()

function run<T extends unknown[]>(action: (...args: T) => Promise<void>) {
  return (...args: T) => {
    action(...args).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
  }
}

function parseId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid todo id: ${value}`)
  }
  return id
}

function normalizeStatus(value: string): TodoStatus {
  const status = value.toUpperCase()
  if (status !== 'TODO' && status !== 'DOING' && status !== 'DONE') {
    throw new Error(`Invalid status: ${value}`)
  }
  return status
}

function normalizePriority(value: string): TodoPriority {
  const priority = value.toUpperCase()
  if (priority !== 'LOW' && priority !== 'MEDIUM' && priority !== 'HIGH') {
    throw new Error(`Invalid priority: ${value}`)
  }
  return priority
}

function printTodos(todos: Todo[]) {
  for (const todo of todos) {
    const description = todo.description ? ` - ${todo.description}` : ''
    console.log(`#${todo.id} [${todo.status}] [${todo.priority}] ${todo.title}${description}`)
  }
}
