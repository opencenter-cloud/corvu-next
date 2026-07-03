import { combineStyle, type ElementOf, type Ref } from '@corvu-next/utils/dom'
import { createMemo, Show } from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { mergeRefs, some } from '@corvu-next/utils/reactivity'
import { dataIf } from '@corvu-next/utils'
import Dismissible from '@corvu-next/dismissible'
import { useInternalDialogContext } from '@src/context'
import { omit } from 'solid-js'

export type DialogContentCorvuProps = {
  /**
   * Whether the dialog content should be forced to render. Useful when using third-party animation libraries.
   * @defaultValue `false`
   */
  forceMount?: boolean
  /**
   * The `id` of the dialog context to use.
   */
  contextId?: string
}

export type DialogContentSharedElementProps<T extends ValidComponent = 'div'> =
  {
    ref: Ref<ElementOf<T>>
    style: string | JSX.CSSProperties
  }

export type DialogContentElementProps = DialogContentSharedElementProps & {
  id: string
  role: 'dialog' | 'alertdialog'
  tabIndex: '-1'
  'aria-describedby': string | undefined
  'aria-labelledby': string | undefined
  'aria-modal': 'true' | 'false'
  'data-closed': '' | undefined
  'data-open': '' | undefined
  'data-corvu-dialog-content': '' | null
}

export type DialogContentProps<T extends ValidComponent = 'div'> =
  DialogContentCorvuProps & Partial<DialogContentSharedElementProps<T>>

/** Content of the dialog. Can be animated.
 *
 * @data `data-corvu-dialog-content` - Present on every dialog content element.
 * @data `data-open` - Present when the dialog is open.
 * @data `data-closed` - Present when the dialog is closed.
 */
const DialogContent = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, DialogContentProps<T>>,
) => {
  const otherProps = omit(props as DialogContentProps,
    'forceMount',
    'contextId',
    'ref',
    'style',
  )

  const context = createMemo(() =>
    useInternalDialogContext(props.contextId),
  )

  const show = () =>
    some(context().open, () => (props as DialogContentProps).forceMount, context().contentPresent)

  const enableDismissible = createMemo(
    () => context().open() || context().contentPresent(),
  )

  return (
    <Dismissible
      element={context().contentRef}
      enabled={enableDismissible()}
      dismissibleId={context().dialogId()}
      onDismiss={() => context().setOpen(false)}
      dismissOnEscapeKeyDown={context().closeOnEscapeKeyDown}
      dismissOnOutsideFocus={context().closeOnOutsideFocus}
      dismissOnOutsidePointer={context().closeOnOutsidePointer}
      outsidePointerStrategy={context().closeOnOutsidePointerStrategy}
      outsidePointerIgnore={() => [context().triggerRef()]}
      noOutsidePointerEvents={context().noOutsidePointerEvents}
      onEscapeKeyDown={context().onEscapeKeyDown}
      onOutsideFocus={context().onOutsideFocus}
      onOutsidePointer={context().onOutsidePointer}
    >
      {(dismissibleProps) => (
        <Show when={show()}>
          <Dynamic<DialogContentElementProps>
            as="div"
            // === SharedElementProps ===
            ref={mergeRefs(context().setContentRef, (props as DialogContentProps).ref)}
            style={combineStyle(
              {
                'pointer-events': dismissibleProps.isLastLayer ? 'auto' : undefined,
              },
              (props as DialogContentProps).style,
            )}
            // === ElementProps ===
            id={context().dialogId()}
            role={context().role()}
            tabIndex="-1"
            aria-describedby={context().descriptionId()}
            aria-labelledby={context().labelId()}
            aria-modal={context().modal() ? 'true' : 'false'}
            data-closed={dataIf(!context().open())}
            data-open={dataIf(context().open())}
            data-corvu-dialog-content=""
            {...otherProps}
          />
        </Show>
      )}
    </Dismissible>
  )
}

export default DialogContent
