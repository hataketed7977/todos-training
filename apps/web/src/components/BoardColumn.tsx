import Button from '@douyinfe/semi-ui/lib/es/button'
import Card from '@douyinfe/semi-ui/lib/es/card'
import Empty from '@douyinfe/semi-ui/lib/es/empty'
import Space from '@douyinfe/semi-ui/lib/es/space'
import Tag from '@douyinfe/semi-ui/lib/es/tag'
import IconPlus from '@douyinfe/semi-icons/lib/es/icons/IconPlus'
import type { Todo } from '../types/todo'
import { zhCN as i18n } from '../i18n/zhCN'
import type { TodoBoardColumn } from '../types/todoBoard'
import { TodoCard } from './TodoCard'

interface BoardColumnProps {
  column: TodoBoardColumn
  todos: Todo[]
  onCreate: () => void
  onDelete: (id: number) => void
  deleting: Set<number>
}

export function BoardColumn({
  column,
  todos,
  onCreate,
  onDelete,
  deleting,
}: BoardColumnProps) {
  return (
    <Card
      style={{
        background: '#f3f6fa',
        borderRadius: 8,
        boxSizing: 'border-box',
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
      headerStyle={{ flexShrink: 0 }}
      title={<Tag color={column.tone}>{column.label}</Tag>}
      headerExtraContent={
        column.status === 'TODO' ? (
          <Button
            aria-label={i18n.addTodo}
            icon={<IconPlus />}
            size="small"
            theme="solid"
            type="primary"
            onClick={onCreate}
          />
        ) : null
      }
      bodyStyle={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 12,
        scrollbarGutter: 'stable',
      }}
    >
      <Space vertical spacing={12} style={{ display: 'flex', minHeight: '100%', width: '100%' }}>
        {todos.length === 0 ? (
          <div
            style={{
              borderRadius: 8,
              display: 'grid',
              flex: 1,
              minHeight: '100%',
              placeItems: 'center',
              width: '100%',
            }}
          >
            <Empty
              title={i18n.noTasks}
              description={i18n.emptyColumn}
            />
          </div>
        ) : null}
        {todos.map((todo) => (
          <TodoCard
            key={todo.id}
            todo={todo}
            onDelete={onDelete}
            deleting={deleting.has(todo.id)}
          />
        ))}
      </Space>
    </Card>
  )
}
