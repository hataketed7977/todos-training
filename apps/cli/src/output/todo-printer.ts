import type { Todo } from '../types/todo.js'

export function printTodos(todos: Todo[], write: (line: string) => void = console.log) {
  for (const todo of todos) {
    write('#' + todo.id + ' [' + todo.status + '] ' + todo.title)
  }
}
