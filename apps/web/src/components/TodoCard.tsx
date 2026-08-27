import Card from '@douyinfe/semi-ui/lib/es/card'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
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
}

export function TodoCard({ todo }: TodoCardProps) {
  return (
    <Card
      shadows="hover"
      style={{ borderRadius: 8, width: '100%' }}
      bodyStyle={{ padding: 12 }}
    >
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <Text strong>{todo.title}</Text>
      </div>
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
    </Card>
  )
}
