import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Badge from '@douyinfe/semi-ui/lib/es/badge'
import Button from '@douyinfe/semi-ui/lib/es/button'
import Card from '@douyinfe/semi-ui/lib/es/card'
import DragMove from '@douyinfe/semi-ui/lib/es/dragMove'
import Empty from '@douyinfe/semi-ui/lib/es/empty'
import Input from '@douyinfe/semi-ui/lib/es/input'
import Layout from '@douyinfe/semi-ui/lib/es/layout'
import Select from '@douyinfe/semi-ui/lib/es/select'
import Skeleton from '@douyinfe/semi-ui/lib/es/skeleton'
import Space from '@douyinfe/semi-ui/lib/es/space'
import Tag from '@douyinfe/semi-ui/lib/es/tag'
import Toast from '@douyinfe/semi-ui/lib/es/toast'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import { Col, Row } from '@douyinfe/semi-ui/lib/es/grid'
import IconArrowLeft from '@douyinfe/semi-icons/lib/es/icons/IconArrowLeft'
import IconArrowRight from '@douyinfe/semi-icons/lib/es/icons/IconArrowRight'
import IconDelete from '@douyinfe/semi-icons/lib/es/icons/IconDelete'
import IconPlus from '@douyinfe/semi-icons/lib/es/icons/IconPlus'
import IconRefresh from '@douyinfe/semi-icons/lib/es/icons/IconRefresh'
import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodoStatus,
} from './api/todos'
import type { Todo, TodoPriority, TodoStatus } from './api/todos'
import { zhCN as i18n } from './i18n/zhCN'
import './App.css'

const { Header, Content } = Layout
const { Text, Title } = Typography

const columns: Array<{ status: TodoStatus; label: string; tone: 'blue' | 'green' | 'grey' }> = [
  { status: 'TODO', label: i18n.status.TODO, tone: 'grey' },
  { status: 'DOING', label: i18n.status.DOING, tone: 'blue' },
  { status: 'DONE', label: i18n.status.DONE, tone: 'green' },
]

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshTodos()
  }, [])

  const todosByStatus = useMemo(
    () =>
      columns.reduce(
        (groups, column) => ({
          ...groups,
          [column.status]: todos.filter((todo) => todo.status === column.status),
        }),
        {} as Record<TodoStatus, Todo[]>,
      ),
    [todos],
  )

  async function refreshTodos() {
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) {
      return
    }

    try {
      const todo = await createTodo({
        title,
        description,
        priority,
      })
      setTodos((current) => [todo, ...current])
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setError(null)
      Toast.success(i18n.added)
    } catch {
      setError(i18n.createFailed)
      Toast.error(i18n.createFailed)
    }
  }

  async function moveTodo(id: number, status: TodoStatus) {
    try {
      const updated = await updateTodoStatus(id, status)
      setTodos((current) => current.map((todo) => (todo.id === id ? updated : todo)))
      setError(null)
    } catch {
      setError(i18n.updateFailed)
      Toast.error(i18n.updateFailed)
    }
  }

  async function removeTodo(id: number) {
    try {
      await deleteTodo(id)
      setTodos((current) => current.filter((todo) => todo.id !== id))
      setError(null)
      Toast.success(i18n.deleted)
    } catch {
      setError(i18n.deleteFailed)
      Toast.error(i18n.deleteFailed)
    }
  }

  return (
    <Layout className="app-layout">
      <Layout className="workspace-layout">
        <Header className="app-header">
          <div className="header-title">
            <Title heading={4}>{i18n.appName}</Title>
            <Text>{i18n.subtitle}</Text>
          </div>
          <Space>
            <Tag color="white">{i18n.totalTasks} {todos.length}</Tag>
            <Tag color="white">
              {i18n.openTasks} {todos.filter((todo) => todo.status !== 'DONE').length}
            </Tag>
            <Button
              icon={<IconRefresh />}
              theme="solid"
              type="tertiary"
              onClick={refreshTodos}
            >
              {i18n.refresh}
            </Button>
          </Space>
        </Header>

        <Content className="app-content">
          <Card className="board-toolbar" bodyStyle={{ padding: 14 }}>
            <form className="todo-form" onSubmit={handleSubmit}>
              <Input
                aria-label={i18n.addTodo}
                placeholder={i18n.addTodo}
                prefix={<IconPlus />}
                value={title}
                onChange={setTitle}
              />
              <Input
                aria-label={i18n.description}
                placeholder={i18n.description}
                value={description}
                onChange={setDescription}
              />
              <Select
                aria-label="优先级"
                value={priority}
                onChange={(value) => setPriority(value as TodoPriority)}
                style={{ width: 132 }}
              >
                <Select.Option value="LOW">{i18n.priority.LOW}</Select.Option>
                <Select.Option value="MEDIUM">{i18n.priority.MEDIUM}</Select.Option>
                <Select.Option value="HIGH">{i18n.priority.HIGH}</Select.Option>
              </Select>
              <Button htmlType="submit" theme="solid" type="primary" disabled={!title.trim()}>
                {i18n.add}
              </Button>
            </form>
          </Card>

          {error ? (
            <Card className="error-card" bodyStyle={{ padding: '10px 14px' }}>
              <Text type="danger">{error}</Text>
            </Card>
          ) : null}

          <section className="board-surface">
            <div className="lane-header">
              <div>
                <Text className="lane-kicker">{i18n.defaultLane}</Text>
                <Title heading={5}>{i18n.execution}</Title>
              </div>
              <Badge count={todos.length} overflowCount={999} type="primary" />
            </div>

            <Skeleton placeholder={<Skeleton.Paragraph rows={8} />} loading={loading} active>
              <Row gutter={[16, 16]} className="board" aria-label="Todo board">
                {columns.map((column) => (
                  <Col xs={24} md={8} key={column.status}>
                    <Card
                      className="board-column"
                      title={
                        <Space>
                          <Tag color={column.tone}>{column.label}</Tag>
                          <Text type="tertiary">
                            {todosByStatus[column.status]?.length ?? 0}
                          </Text>
                        </Space>
                      }
                      bodyStyle={{ padding: 12, minHeight: 430 }}
                    >
                      <div className="cards">
                        {(todosByStatus[column.status] ?? []).length === 0 ? (
                          <Empty
                            className="empty-column"
                            title={i18n.noTasks}
                            description={i18n.emptyColumn}
                          />
                        ) : null}
                        {(todosByStatus[column.status] ?? []).map((todo) => (
                          <TodoCard
                            key={todo.id}
                            todo={todo}
                            onMove={moveTodo}
                            onDelete={removeTodo}
                          />
                        ))}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Skeleton>
          </section>
        </Content>
      </Layout>
    </Layout>
  )
}

interface TodoCardProps {
  todo: Todo
  onMove: (id: number, status: TodoStatus) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

function TodoCard({ todo, onMove, onDelete }: TodoCardProps) {
  const previousStatus = getPreviousStatus(todo.status)
  const nextStatus = getNextStatus(todo.status)

  return (
    <DragMove positionStrategy="relative">
      <Card className="todo-card" bodyStyle={{ padding: 12 }}>
        <div className="todo-card-main">
          <div>
            <Text strong>{todo.title}</Text>
            {todo.description ? (
              <Text className="todo-description" type="tertiary">
                {todo.description}
              </Text>
            ) : null}
          </div>
          <Tag color={getPriorityColor(todo.priority)}>{i18n.priority[todo.priority]}</Tag>
        </div>

        <div className="todo-card-footer">
          <Text type="quaternary">#{todo.id}</Text>
          <Space spacing={4}>
            <Button
              aria-label={i18n.moveLeft}
              disabled={!previousStatus}
              icon={<IconArrowLeft />}
              size="small"
              theme="borderless"
              type="tertiary"
              onClick={() => previousStatus && onMove(todo.id, previousStatus)}
            />
            <Button
              aria-label={i18n.moveRight}
              disabled={!nextStatus}
              icon={<IconArrowRight />}
              size="small"
              theme="borderless"
              type="tertiary"
              onClick={() => nextStatus && onMove(todo.id, nextStatus)}
            />
            <Button
              aria-label={i18n.delete}
              icon={<IconDelete />}
              size="small"
              theme="borderless"
              type="danger"
              onClick={() => onDelete(todo.id)}
            />
          </Space>
        </div>
      </Card>
    </DragMove>
  )
}

function getPreviousStatus(status: TodoStatus): TodoStatus | null {
  if (status === 'DOING') {
    return 'TODO'
  }
  if (status === 'DONE') {
    return 'DOING'
  }
  return null
}

function getNextStatus(status: TodoStatus): TodoStatus | null {
  if (status === 'TODO') {
    return 'DOING'
  }
  if (status === 'DOING') {
    return 'DONE'
  }
  return null
}

function getPriorityColor(priority: TodoPriority) {
  if (priority === 'HIGH') {
    return 'red'
  }
  if (priority === 'LOW') {
    return 'grey'
  }
  return 'orange'
}

export default App
