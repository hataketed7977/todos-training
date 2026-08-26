import type { Todo } from '../../types/todo.js'

export interface TodoApiClient {
  listTodos(): Promise<Todo[]>
  createTodo(input: { title: string }): Promise<Todo>
}
