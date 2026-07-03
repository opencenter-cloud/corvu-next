import { combineStyle, type ElementOf, type Ref } from '@corvu-next/utils/dom'
import { createMemo, Show } from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { mergeRefs, some } from '@corvu-next/utils/reactivity'
import { dataIf } from '@corvu-next/utils'
import { useInternalDialogContext } from '@src/context'
import { omit } from 'solid-js'

export type DialogOverlayCorvuProps = {
  /**
   * Whether the dialog overlay should be forced to render. Useful when using third-party animation libraries.
   * @defaultValue `false`
   */
  forceMount?: boolean
  /**
   * The `id` of the dialog context to use.
   */
  contextId?: string
}

export type DialogOverlaySharedElementProps<T extends ValidComponent = 'div'> =
  {
    ref: Ref<ElementOf<T>>
    style: string | JSX.CSSProperties
  }

export type DialogOverlayElementProps = DialogOverlaySharedElementProps & {
  'aria-hidden': 'true' | undefined
  'data-closed': '' | undefined
  'data-open': '' | undefined
  'data-corvu-dialog-overlay': '' | null
}

export type DialogOverlayProps<T extends ValidComponent = 'div'> =
  DialogOverlayCorvuProps & Partial<DialogOverlaySharedElementProps<T>>

/** Component which can be used to create a faded background. Can be animated.
 *
 * @data `data-corvu-dialog-overlay` - Present on every dialog overlay element.
 * @data `data-open` - Present when the dialog is open.
 * @data `data-closed` - Present when the dialog is closed.
 */
const DialogOverlay = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, DialogOverlayProps<T>>,
) => {
  const otherProps = omit(props as DialogOverlayProps,
    'forceMount',
    'contextId',
    'ref',
    'style',
  )

  const context = createMemo(() =>
    useInternalDialogContext((props as DialogOverlayProps).contextId),
  )

  const show = () =>
    some(context().open, () => (props as DialogOverlayProps).forceMount, context().overlayPresent)

  return (
    <Show when={show()}>
      <Dynamic<DialogOverlayElementProps>
        as="div"
        // === SharedElementProps ===
        ref={mergeRefs(context().setOverlayRef, (props as DialogOverlayProps).ref)}
        style={combineStyle(
          {
            'pointer-events': 'auto',
          },
          (props as DialogOverlayProps).style,
        )}
        // === ElementProps ===
        aria-hidden="true"
        data-closed={dataIf(!context().open())}
        data-open={dataIf(context().open())}
        data-corvu-dialog-overlay=""
        {...otherProps}
      />
    </Show>
  )
}

export default DialogOverlay
