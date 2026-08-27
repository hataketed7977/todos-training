import { useEffect, useRef } from 'react'
import { Form } from '@douyinfe/semi-ui/lib/es/form'
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form'
import Modal from '@douyinfe/semi-ui/lib/es/modal'
import { zhCN as i18n } from '../i18n/zhCN'
import type { TodoPriority } from '../types/todo'

interface CreateTodoFormValues {
  title?: string
  description?: string
  priority?: TodoPriority
}

interface CreateTodoModalProps {
  visible: boolean
  creating: boolean
  onCancel: () => void
  onCreate: (input: {
    title: string
    description?: string | null
    priority?: TodoPriority | null
  }) => Promise<void>
}

const priorityOptions: { value: TodoPriority; label: string }[] = [
  { value: 'LOW', label: i18n.priorityLow },
  { value: 'MEDIUM', label: i18n.priorityMedium },
  { value: 'HIGH', label: i18n.priorityHigh },
]

export function CreateTodoModal({
  visible,
  creating,
  onCancel,
  onCreate,
}: CreateTodoModalProps) {
  const formApiRef = useRef<FormApi<CreateTodoFormValues> | null>(null)

  useEffect(() => {
    if (!visible) {
      formApiRef.current?.reset()
    }
  }, [visible])

  async function handleSubmit(values: CreateTodoFormValues) {
    const trimmedTitle = values.title?.trim() ?? ''
    if (!trimmedTitle) {
      return
    }

    const trimmedDescription = values.description?.trim()
    const description = trimmedDescription ? trimmedDescription : null

    try {
      await onCreate({
        title: trimmedTitle,
        description,
        priority: values.priority ?? null,
      })
      formApiRef.current?.reset()
    } catch {
      // The hook already reports the failure with a Toast. Keep the modal open
      // so the user can retry or edit the title.
    }
  }

  return (
    <Modal
      title={i18n.addTodo}
      visible={visible}
      width={480}
      style={{ margin: '48px auto 0' }}
      okText={i18n.add}
      cancelText={i18n.cancel}
      confirmLoading={creating}
      onOk={() => {
        formApiRef.current?.submitForm()
      }}
      onCancel={onCancel}
    >
      <Form<CreateTodoFormValues>
        key={visible ? 'create-open' : 'create-closed'}
        layout="vertical"
        getFormApi={(formApi) => {
          formApiRef.current = formApi
        }}
        onSubmit={(values) => {
          void handleSubmit(values)
        }}
      >
        <Form.Input
          aria-label={i18n.todoTitle}
          autoFocus
          field="title"
          noLabel
          placeholder={i18n.todoTitlePlaceholder}
          showClear
          validator={(value) => (String(value ?? '').trim() ? '' : i18n.titleRequired)}
        />
        <Form.TextArea
          aria-label={i18n.todoDescription}
          field="description"
          noLabel
          placeholder={i18n.todoDescriptionPlaceholder}
          autosize
          maxCount={2000}
          style={{ marginTop: 12 }}
        />
        <Form.Select
          aria-label={i18n.todoPriority}
          field="priority"
          noLabel
          placeholder={i18n.todoPriorityPlaceholder}
          optionList={priorityOptions}
          showClear
          style={{ width: '100%', marginTop: 12 }}
        />
      </Form>
    </Modal>
  )
}
