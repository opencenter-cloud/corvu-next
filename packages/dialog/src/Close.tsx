import { callEventHandler, type ElementOf } from '@corvu-next/utils/dom'
import { type Component, omit } from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import {
  DynamicButton,
  type DynamicButtonElementProps,
  type DynamicButtonSharedElementProps,
  type DynamicProps,
} from '@corvu-next/utils/dynamic'
import { useInternalDialogContext } from '@src/context'

export type DialogCloseCorvuProps = {
  /**
   * The `id` of the dialog context to use.
   */
  contextId?: string
}

export type DialogCloseSharedElementProps<T extends ValidComponent = 'button'> =
  {
    onClick: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
  } & DynamicButtonSharedElementProps<T>

export type DialogCloseElementProps = DialogCloseSharedElementProps & {
  'aria-label': 'close'
  'data-corvu-dialog-close': '' | null
} & DynamicButtonElementProps

export type DialogCloseProps<T extends ValidComponent = 'button'> =
  DialogCloseCorvuProps & Partial<DialogCloseSharedElementProps<T>>

/** Close button that changes the open state to false when clicked.
 *
 * @data `data-corvu-dialog-close` - Present on every dialog close element.
 */
const DialogClose = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, DialogCloseProps<T>>,
) => {
  const otherProps = omit(props as DialogCloseProps,
    'contextId',
    'onClick',
  )

  const context = useInternalDialogContext((props as DialogCloseProps).contextId)

  const onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (
    event,
  ) => {
    !callEventHandler((props as DialogCloseProps).onClick, event) && context.setOpen(false)
  }

  return (
    <DynamicButton<
      Component<Omit<DialogCloseElementProps, keyof DynamicButtonElementProps>>
    >
      // === SharedElementProps ===
      onClick={onClick}
      // === ElementProps ===
      aria-label="close"
      data-corvu-dialog-close=""
      {...otherProps}
    />
  )
}

export default DialogClose
