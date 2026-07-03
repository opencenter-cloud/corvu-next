import { callEventHandler, type ElementOf } from '@corvu-next/utils/dom'
import { type Component, omit } from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import {
  DynamicButton,
  type DynamicButtonElementProps,
  type DynamicButtonSharedElementProps,
  type DynamicProps,
} from '@corvu-next/utils/dynamic'
import { dataIf } from '@corvu-next/utils'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalDialogContext } from '@src/context'

export type DialogTriggerCorvuProps = {
  /**
   * The `id` of the dialog context to use.
   */
  contextId?: string
}

export type DialogTriggerSharedElementProps<
  T extends ValidComponent = 'button',
> = {
  onClick: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
} & DynamicButtonSharedElementProps<T>

export type DialogTriggerElementProps = DialogTriggerSharedElementProps & {
  'aria-controls': string
  'aria-expanded': 'true' | 'false'
  'aria-haspopup': 'dialog'
  'data-closed': '' | undefined
  'data-open': '' | undefined
  'data-corvu-dialog-trigger': '' | null
} & DynamicButtonElementProps

export type DialogTriggerProps<T extends ValidComponent = 'button'> =
  DialogTriggerCorvuProps & Partial<DialogTriggerSharedElementProps<T>>

/** Button that changes the open state of the dialog when clicked.
 *
 * @data `data-corvu-dialog-trigger` - Present on every dialog trigger element.
 * @data `data-open` - Present when the dialog is open.
 * @data `data-closed` - Present when the dialog is closed.
 */
const DialogTrigger = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, DialogTriggerProps<T>>,
) => {
  const otherProps = omit(props as DialogTriggerProps,
    'contextId',
    'ref',
    'onClick',
  )

  const context =
    useInternalDialogContext((props as DialogTriggerProps).contextId)

  const onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (e) => {
    !callEventHandler((props as DialogTriggerProps).onClick, e) &&
      context.setOpen((open) => !open)
  }

  return (
    <DynamicButton<
      Component<
        Omit<DialogTriggerElementProps, keyof DynamicButtonElementProps>
      >
    >
      // === SharedElementProps ===
      ref={mergeRefs(context.setTriggerRef, (props as DialogTriggerProps).ref)}
      onClick={onClick}
      // === ElementProps ===
      aria-controls={context.dialogId()}
      aria-expanded={context.open() ? 'true' : 'false'}
      aria-haspopup="dialog"
      data-closed={dataIf(!context.open())}
      data-open={dataIf(context.open())}
      data-corvu-dialog-trigger=""
      {...otherProps}
    />
  )
}

export default DialogTrigger
