import { useCallback, useEffect, useMemo, useState } from 'react'
import Toast from '@douyinfe/semi-ui/lib/es/toast'
import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
} from '@services/todosService'
import type { Todo, TodoPriority, TodoStatus } from '@typings/todo'
import { todoStatuses } from '@typings/todo'
import { zhCN as i18n } from '@i18n/zhCN'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Set<number>>(new Set())
  const [updating, setUpdating] = useState<Set<number>>(new Set())

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

  async function addTodo(input: {
    title: string
    description?: string | null
    priority?: TodoPriority | null
  }) {
    const trimmedTitle = input.title.trim()
    if (!trimmedTitle) {
      return
    }

    const trimmedDescription = input.description?.trim()
    const description = trimmedDescription ? trimmedDescription : null

    try {
      setCreating(true)
      const todo = await createTodo({
        title: trimmedTitle,
        description,
        priority: input.priority ?? null,
      })
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

  async function removeTodo(id: number) {
    setDeleting(prev => new Set(prev).add(id))
    try {
      await deleteTodo(id)
      setTodos(prev => prev.filter(t => t.id !== id))
      setError(null)
      Toast.success(i18n.deleted)
    } catch {
      setError(i18n.deleteFailed)
      Toast.error(i18n.deleteFailed)
    } finally {
      setDeleting(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function editTodo(
    id: number,
    input: {
      title: string
      description?: string | null
      priority?: TodoPriority | null
    },
  ) {
    const trimmedTitle = input.title.trim()
    if (!trimmedTitle) {
      return
    }
    const trimmedDescription = input.description?.trim()
    const description = trimmedDescription ? trimmedDescription : null

    setUpdating(prev => new Set(prev).add(id))
    try {
      const updated = await updateTodo(id, {
        title: trimmedTitle,
        description,
        priority: input.priority ?? null,
      })
      setTodos(prev => prev.map(t => (t.id === id ? updated : t)))
      setError(null)
      Toast.success(i18n.saved)
    } catch {
      setError(i18n.editFailed)
      Toast.error(i18n.editFailed)
      await refreshTodos()
    } finally {
      setUpdating(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function moveTodo(id: number, newStatus: TodoStatus) {
    const original = todos.find(t => t.id === id)
    if (!original) return

    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    setUpdating(prev => new Set(prev).add(id))
    try {
      await updateTodo(id, {
        title: original.title,
        description: original.description,
        priority: original.priority,
        status: newStatus,
      })
      setError(null)
      Toast.success(i18n.saved)
    } catch {
      setError(i18n.editFailed)
      Toast.error(i18n.editFailed)
      await refreshTodos()
    } finally {
      setUpdating(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return {
    todos,
    todosByStatus,
    error,
    loading,
    creating,
    deleting,
    updating,
    addTodo,
    removeTodo,
    editTodo,
    moveTodo,
  }
}
