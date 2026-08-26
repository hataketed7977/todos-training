export type TodoStatus = 'TODO' | 'DOING' | 'DONE'

export interface Todo {
  id: number
  title: string
  status: TodoStatus
  createdAt: string
  updatedAt: string
}

export const todoStatuses: TodoStatus[] = ['TODO', 'DOING', 'DONE']
