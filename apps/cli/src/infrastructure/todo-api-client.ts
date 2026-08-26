import type { HttpClient } from './http-client.js'
import type { TodoApiClient } from '../application/ports/todo-api-client.js'
import type { Todo } from '../types/todo.js'

export function createTodoApiClient(http: HttpClient): TodoApiClient {
  return {
    listTodos: () => http.request<Todo[]>('/api/todos'),
    createTodo: (input) => http.request<Todo>('/api/todos', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  }
}
