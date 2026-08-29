import Space from '@douyinfe/semi-ui/lib/es/space'
import Tag from '@douyinfe/semi-ui/lib/es/tag'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import type { Todo } from '@typings/todo'
import { todoBoardColumns } from '@typings/todoBoard'
import { zhCN as i18n } from '@i18n/zhCN'

const { Text, Title } = Typography
const headerStatusTagStyle = {
  total: {
    background: 'rgb(168 85 247 / 24%)',
    color: 'rgb(233 213 255)',
  },
  grey: {
    background: 'rgb(255 255 255 / 12%)',
    color: 'rgb(255 255 255 / 84%)',
  },
  blue: {
    background: 'rgb(0 100 250 / 22%)',
    color: 'rgb(138 205 255)',
  },
  green: {
    background: 'rgb(59 179 70 / 22%)',
    color: 'rgb(164 224 167)',
  },
} as const

interface AppHeaderProps {
  todos: Todo[]
}

export function AppHeader({ todos }: AppHeaderProps) {
  const statusCounts = todoBoardColumns.reduce(
    (counts, status) => ({
      ...counts,
      [status.status]: todos.filter((todo) => todo.status === status.status).length,
    }),
    {} as Record<(typeof todoBoardColumns)[number]['status'], number>,
  )

  return (
    <header
      style={{
        alignItems: 'center',
        borderBottom: '1px solid rgb(255 255 255 / 10%)',
        display: 'flex',
        height: 76,
        justifyContent: 'space-between',
        padding: '0 32px',
      }}
    >
      <Space vertical align="start" spacing={2}>
        <Title heading={4} style={{ color: '#fff', margin: 0 }}>
          {i18n.appName}
        </Title>
        <Text style={{ color: 'rgb(255 255 255 / 68%)' }}>{i18n.subtitle}</Text>
      </Space>
      <Space>
        <Tag style={headerStatusTagStyle.total}>
          {i18n.totalTasks} {todos.length}
        </Tag>
        {todoBoardColumns.map((column) => (
          <Tag
            key={column.status}
            style={headerStatusTagStyle[column.tone]}
          >
            {column.label} {statusCounts[column.status]}
          </Tag>
        ))}
      </Space>
    </header>
  )
}
