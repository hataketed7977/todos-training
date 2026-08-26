import Card from '@douyinfe/semi-ui/lib/es/card'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import type { Todo } from '../types/todo'

const { Text } = Typography

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
    </Card>
  )
}
