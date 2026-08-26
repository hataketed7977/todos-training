import { useState } from 'react'
import Card from '@douyinfe/semi-ui/lib/es/card'
import Layout from '@douyinfe/semi-ui/lib/es/layout'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import { AppHeader } from '../components/AppHeader'
import { CreateTodoModal } from '../components/CreateTodoModal'
import { TodoBoard } from '../components/TodoBoard'
import { useTodos } from '../hooks/useTodos'

const { Content } = Layout
const { Text } = Typography

export function TodosBoardPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const {
    todos,
    todosByStatus,
    error,
    loading,
    creating,
    addTodo,
  } = useTodos()

  async function handleCreate(title: string) {
    await addTodo(title)
    setIsCreateOpen(false)
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
        />

        <CreateTodoModal
          visible={isCreateOpen}
          creating={creating}
          onCancel={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
        />
      </Content>
    </Layout>
  )
}
