import { useState } from 'react'
import Skeleton from '@douyinfe/semi-ui/lib/es/skeleton'
import { Col, Row } from '@douyinfe/semi-ui/lib/es/grid'
import type { Todo, TodoStatus } from '../types/todo'
import { BoardColumn } from './BoardColumn'
import { todoBoardColumns } from '../types/todoBoard'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import type {
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { TodoCard } from './TodoCard'

export const TODO_BOARD_ARIA_LABEL = 'Todo board'

interface TodoBoardProps {
  loading: boolean
  todosByStatus: Record<TodoStatus, Todo[]>
  onCreate: () => void
  onDelete: (id: number) => void
  deleting: Set<number>
  onEdit: (todo: Todo) => void
  editing: Set<number>
  onMove: (id: number, newStatus: TodoStatus) => void
  moving: Set<number>
}

export function TodoBoard({
  loading,
  todosByStatus,
  onCreate,
  onDelete,
  deleting,
  onEdit,
  editing,
  onMove,
  moving,
}: TodoBoardProps) {
  const [activeTodoId, setActiveTodoId] = useState<number | null>(null)

  const allTodos: Todo[] = []
  for (const status of Object.keys(todosByStatus) as TodoStatus[]) {
    allTodos.push(...todosByStatus[status])
  }
  const todoById = new Map(allTodos.map(t => [t.id, t]))
  const activeTodo = activeTodoId != null ? todoById.get(activeTodoId) ?? null : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveTodoId(Number(event.active.id))
  }

  function handleDragEnd(_event: DragEndEvent) {
    setActiveTodoId(null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    const activeTodoItem = todoById.get(activeId)
    if (!activeTodoItem) return

    let targetStatus: TodoStatus | null = null
    const overId = over.id

    if (typeof overId === 'string' && overId.startsWith('column-')) {
      targetStatus = overId.slice(7) as TodoStatus
    } else if (typeof overId === 'number') {
      const overTodo = todoById.get(overId)
      if (overTodo) {
        targetStatus = overTodo.status
      }
    }

    if (!targetStatus) return
    if (activeTodoItem.status === targetStatus) return

    onMove(activeId, targetStatus)
  }

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
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
                  onEdit={onEdit}
                  editing={editing}
                  moving={moving}
                />
              </Col>
            ))}
          </Row>
        </Skeleton>
        <DragOverlay>
          {activeTodo ? (
            <div style={{ width: 300 }}>
              <TodoCard
                todo={activeTodo}
                onDelete={() => {}}
                deleting={false}
                onEdit={undefined}
                editing={false}
                moving={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}
