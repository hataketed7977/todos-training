import type { Todo, TodoPriority, TodoStatus } from '@typings/todo'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:18080'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function listTodos(): Promise<Todo[]> {
  return request<Todo[]>('/api/todos')
}

export function createTodo(input: {
  title: string
  description?: string | null
  priority?: TodoPriority | null
  assignee?: string | null
}): Promise<Todo> {
  return request<Todo>('/api/todos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, {
    method: 'DELETE',
  })
}

export function updateTodo(
  id: number,
  input: {
    title: string
    description?: string | null
    priority?: TodoPriority | null
    assignee?: string | null
    status?: TodoStatus | null
  },
): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
