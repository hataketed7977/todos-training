import type { TodoApiClient } from './ports/todo-api-client.js'
import type { Todo } from '../types/todo.js'

export class TodoUseCases {
  constructor(private readonly todoApi: TodoApiClient) {}

  listTodos(): Promise<Todo[]> {
    return this.todoApi.listTodos()
  }

  addTodo(title: string): Promise<Todo> {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      throw new Error('Todo title is required')
    }

    return this.todoApi.createTodo({ title: normalizedTitle })
  }

}
