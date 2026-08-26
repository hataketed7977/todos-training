import { useEffect, useRef } from 'react'
import { Form } from '@douyinfe/semi-ui/lib/es/form'
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form'
import Modal from '@douyinfe/semi-ui/lib/es/modal'
import { zhCN as i18n } from '../i18n/zhCN'

interface CreateTodoFormValues {
  title?: string
}

interface CreateTodoModalProps {
  visible: boolean
  creating: boolean
  onCancel: () => void
  onCreate: (title: string) => Promise<void>
}

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

    try {
      await onCreate(trimmedTitle)
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
      </Form>
    </Modal>
  )
}
