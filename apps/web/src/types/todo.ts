export type TodoStatus = 'TODO' | 'DOING' | 'DONE'
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Todo {
  id: number
  title: string
  status: TodoStatus
  description: string | null
  priority: TodoPriority | null
  createdAt: string
  updatedAt: string
}

export const todoStatuses: TodoStatus[] = ['TODO', 'DOING', 'DONE']
export const todoPriorities: TodoPriority[] = ['LOW', 'MEDIUM', 'HIGH']
