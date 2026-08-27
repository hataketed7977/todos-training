import Skeleton from '@douyinfe/semi-ui/lib/es/skeleton'
import { Col, Row } from '@douyinfe/semi-ui/lib/es/grid'
import type { Todo, TodoStatus } from '../types/todo'
import { BoardColumn } from './BoardColumn'
import { todoBoardColumns } from '../types/todoBoard'

export const TODO_BOARD_ARIA_LABEL = 'Todo board'

interface TodoBoardProps {
  loading: boolean
  todosByStatus: Record<TodoStatus, Todo[]>
  onCreate: () => void
  onDelete: (id: number) => void
  deleting: Set<number>
}

export function TodoBoard({
  loading,
  todosByStatus,
  onCreate,
  onDelete,
  deleting,
}: TodoBoardProps) {
  return (
    <section
      style={{
        background: '#d7deea',
        border: '1px solid rgb(100 116 139 / 18%)',
        borderRadius: 12,
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 42%)',
        boxSizing: 'border-box',
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: 18,
      }}
    >
      <Skeleton
        placeholder={<Skeleton.Paragraph rows={8} />}
        loading={loading}
        active
        style={{ height: '100%' }}
      >
        <Row
          gutter={[16, 16]}
          aria-label={TODO_BOARD_ARIA_LABEL}
          style={{ flex: 1, height: '100%', minHeight: 0 }}
        >
          {todoBoardColumns.map((column) => (
            <Col
              xs={24}
              md={8}
              key={column.status}
              style={{ display: 'flex', height: '100%', minHeight: 0 }}
            >
              <BoardColumn
                column={column}
                todos={todosByStatus[column.status] ?? []}
                onCreate={onCreate}
                onDelete={onDelete}
                deleting={deleting}
              />
            </Col>
          ))}
        </Row>
      </Skeleton>
    </section>
  )
}
