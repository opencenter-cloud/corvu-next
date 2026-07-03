import { createMemo, omit } from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import type { ElementOf, Ref } from '@corvu-next/utils/dom'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalPopoverContext } from '@src/context'

export type PopoverAnchorCorvuProps = {
  /**
   * The `id` of the popover context to use.
   */
  contextId?: string
}

export type PopoverAnchorSharedElementProps<T extends ValidComponent = 'div'> =
  {
    ref: Ref<ElementOf<T>>
  }

export type PopoverAnchorElementProps = PopoverAnchorSharedElementProps & {
  'data-corvu-popover-anchor': ''
}

export type PopoverAnchorProps<T extends ValidComponent = 'div'> =
  PopoverAnchorCorvuProps & Partial<PopoverAnchorSharedElementProps<T>>

/** Anchor element to override the floating reference.
 *
 * @data `data-corvu-popover-anchor` - Present on every popover anchor element.
 */
const PopoverAnchor = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, PopoverAnchorProps<T>>,
) => {
  const otherProps = omit(props as PopoverAnchorProps,
    'contextId',
    'ref',
  )

  const context = createMemo(() =>
    useInternalPopoverContext((props as PopoverAnchorProps).contextId),
  )

  return (
    <Dynamic<PopoverAnchorElementProps>
      as="div"
      // === SharedElementProps ===
      ref={mergeRefs(context().setAnchorRef, (props as PopoverAnchorProps).ref)}
      // === ElementProps ===
      data-corvu-popover-anchor=""
      {...otherProps}
    />
  )
}

export default PopoverAnchor
