import { useCallback, useEffect, useMemo, useState } from 'react'
import Toast from '@douyinfe/semi-ui/lib/es/toast'
import {
  createTodo,
  listTodos,
} from '../services/todosService'
import type { Todo, TodoStatus } from '../types/todo'
import { todoStatuses } from '../types/todo'
import { zhCN as i18n } from '../i18n/zhCN'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const refreshTodos = useCallback(async () => {
    try {
      setLoading(true)
      setTodos(await listTodos())
      setError(null)
    } catch {
      setError(i18n.cannotReachApi)
      Toast.error(i18n.cannotReachApi)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshTodos()
  }, [refreshTodos])

  const todosByStatus = useMemo(
    () =>
      todoStatuses.reduce(
        (groups, status) => ({
          ...groups,
          [status]: todos.filter((todo) => todo.status === status),
        }),
        {} as Record<TodoStatus, Todo[]>,
      ),
    [todos],
  )

  async function addTodo(title: string) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }

    try {
      setCreating(true)
      const todo = await createTodo({ title: trimmedTitle })
      setTodos((current) => [todo, ...current])
      setError(null)
      Toast.success(i18n.added)
    } catch {
      setError(i18n.createFailed)
      Toast.error(i18n.createFailed)
      throw new Error(i18n.createFailed)
    } finally {
      setCreating(false)
    }
  }

  return {
    todos,
    todosByStatus,
    error,
    loading,
    creating,
    addTodo,
  }
}
