import { omit } from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import type { ElementOf, Ref } from '@corvu-next/utils/dom'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalTooltipContext } from '@src/context'

export type TooltipAnchorCorvuProps = {
  /**
   * The `id` of the tooltip context to use.
   */
  contextId?: string
}

export type TooltipAnchorSharedElementProps<T extends ValidComponent = 'div'> =
  {
    ref: Ref<ElementOf<T>>
  }

export type TooltipAnchorElementProps = TooltipAnchorSharedElementProps & {
  'data-corvu-tooltip-anchor': ''
}

export type TooltipAnchorProps<T extends ValidComponent = 'div'> =
  TooltipAnchorCorvuProps & Partial<TooltipAnchorSharedElementProps<T>>

/** Anchor element to override the floating reference.
 *
 * @data `data-corvu-tooltip-anchor` - Present on every tooltip anchor element.
 */
const TooltipAnchor = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, TooltipAnchorProps<T>>,
) => {
  const otherProps = omit(props as TooltipAnchorProps,
    'contextId',
    'ref',
  )

  const context = useInternalTooltipContext((props as TooltipAnchorProps).contextId)

  return (
    <Dynamic<TooltipAnchorElementProps>
      as="div"
      // === SharedElementProps ===
      ref={mergeRefs(context.setAnchorRef, (props as TooltipAnchorProps).ref)}
      // === ElementProps ===
      data-corvu-tooltip-anchor=""
      {...otherProps}
    />
  )
}

export default TooltipAnchor
