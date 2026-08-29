import type { TodoStatus } from './todo'
import { zhCN as i18n } from '@i18n/zhCN'

export interface TodoBoardColumn {
  status: TodoStatus
  label: string
  tone: 'blue' | 'green' | 'grey'
}

export const todoBoardColumns: TodoBoardColumn[] = [
  { status: 'TODO', label: i18n.status.TODO, tone: 'grey' },
  { status: 'DOING', label: i18n.status.DOING, tone: 'blue' },
  { status: 'DONE', label: i18n.status.DONE, tone: 'green' },
]
