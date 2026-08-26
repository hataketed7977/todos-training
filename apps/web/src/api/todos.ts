export type TodoStatus = 'TODO' | 'DOING' | 'DONE'
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Todo {
  id: number
  title: string
  description: string | null
  status: TodoStatus
  priority: TodoPriority
  createdAt: string
  updatedAt: string
}

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

export function listTodos() {
  return request<Todo[]>('/api/todos')
}

export function createTodo(input: {
  title: string
  description?: string
  priority: TodoPriority
}) {
  return request<Todo>('/api/todos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTodoStatus(id: number, status: TodoStatus) {
  return request<Todo>(`/api/todos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteTodo(id: number) {
  return request<void>(`/api/todos/${id}`, {
    method: 'DELETE',
  })
}
