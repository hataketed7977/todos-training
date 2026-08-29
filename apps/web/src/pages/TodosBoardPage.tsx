import { useState } from 'react'
import Card from '@douyinfe/semi-ui/lib/es/card'
import Layout from '@douyinfe/semi-ui/lib/es/layout'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import { AppHeader } from '@components/AppHeader'
import { CreateTodoModal } from '@components/CreateTodoModal'
import { TodoBoard } from '@components/TodoBoard'
import { useTodos } from '@hooks/useTodos'
import type { Todo, TodoPriority } from '@typings/todo'

const { Content } = Layout
const { Text } = Typography

export function TodosBoardPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const {
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
  } = useTodos()

  async function handleCreate(input: {
    title: string
    description?: string | null
    priority?: TodoPriority | null
  }) {
    await addTodo(input)
    setIsCreateOpen(false)
  }

  async function handleUpdate(
    id: number,
    input: {
      title: string
      description?: string | null
      priority?: TodoPriority | null
    },
  ) {
    await editTodo(id, input)
    setEditingTodo(null)
  }

  return (
    <Layout style={{ background: 'transparent', height: '100svh', overflow: 'hidden' }}>
      <AppHeader todos={todos} />

      <Content
        style={{
          boxSizing: 'border-box',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          padding: 32,
          width: '100%',
        }}
      >
        {error ? (
          <Card
            bodyStyle={{ padding: '10px 14px' }}
            style={{
              borderColor: 'var(--semi-color-danger-light-default)',
              flexShrink: 0,
              marginBottom: 16,
            }}
          >
            <Text type="danger">{error}</Text>
          </Card>
        ) : null}

        <TodoBoard
          loading={loading}
          todosByStatus={todosByStatus}
          onCreate={() => setIsCreateOpen(true)}
          onDelete={removeTodo}
          deleting={deleting}
          onEdit={(todo) => setEditingTodo(todo)}
          editing={updating}
          onMove={moveTodo}
          moving={updating}
        />

        <CreateTodoModal
          visible={isCreateOpen}
          creating={creating}
          onCancel={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
        />

        <CreateTodoModal
          mode="edit"
          visible={editingTodo !== null}
          initialTodo={editingTodo ?? undefined}
          updating={editingTodo ? updating.has(editingTodo.id) : false}
          onCancel={() => setEditingTodo(null)}
          onUpdate={handleUpdate}
        />
      </Content>
    </Layout>
  )
}
