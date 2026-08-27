import Card from '@douyinfe/semi-ui/lib/es/card'
import Popconfirm from '@douyinfe/semi-ui/lib/es/popconfirm'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import IconDeleteStroked from '@douyinfe/semi-icons/lib/es/icons/IconDeleteStroked'
import type { Todo, TodoPriority } from '../types/todo'
import { zhCN as i18n } from '../i18n/zhCN'

const { Text, Paragraph } = Typography

const priorityLabels: Record<TodoPriority, string> = {
  LOW: i18n.priorityLow,
  MEDIUM: i18n.priorityMedium,
  HIGH: i18n.priorityHigh,
}

interface TodoCardProps {
  todo: Todo
  onDelete: (id: number) => void
  deleting?: boolean
}

export function TodoCard({ todo, onDelete, deleting }: TodoCardProps) {
  return (
    <Card
      shadows="hover"
      style={{ borderRadius: 8, width: '100%' }}
      bodyStyle={{ padding: 12 }}
      className="todo-card-wrapper"
    >
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong>{todo.title}</Text>
          {todo.priority ? (
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
              {i18n.todoPriority}：{priorityLabels[todo.priority]}
            </Text>
          ) : null}
          {todo.description ? (
            <Paragraph
              type="tertiary"
              size="small"
              ellipsis={{ rows: 2, showTooltip: true }}
              style={{ marginBottom: 0, marginTop: 4 }}
            >
              {todo.description}
            </Paragraph>
          ) : null}
        </div>
        <Popconfirm
          title={i18n.deleteConfirmTitle.replace('{title}', todo.title)}
          onConfirm={() => { if (!deleting) onDelete(todo.id) }}
        >
          <span
            className="todo-card-delete-btn"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
            }}
            style={{
              cursor: deleting ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              fontSize: 16,
              color: 'var(--semi-color-danger)',
              opacity: 0,
              transition: 'opacity 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <IconDeleteStroked />
          </span>
        </Popconfirm>
      </div>
      <style>{`
        .todo-card-wrapper:hover .todo-card-delete-btn {
          opacity: 0.6 !important;
        }
        .todo-card-wrapper .todo-card-delete-btn:hover {
          opacity: 1 !important;
        }
      `}</style>
    </Card>
  )
}
