import { type Component, omit } from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import type { ElementOf, Ref } from '@corvu-next/utils/dom'
import type {
  FloatingArrowElementProps,
  FloatingArrowSharedElementProps,
} from '@corvu-next/utils/components/FloatingArrow'
import type { DynamicProps } from '@corvu-next/utils/dynamic'
import FloatingArrow from '@corvu-next/utils/components/FloatingArrow'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalPopoverContext } from '@src/context'

export type PopoverArrowCorvuProps = {
  /**
   * Size of the arrow in px.
   * @defaultValue 16
   */
  size?: number
  /**
   * The `id` of the popover context to use.
   */
  contextId?: string
}

export type PopoverArrowSharedElementProps<T extends ValidComponent = 'div'> = {
  ref: Ref<ElementOf<T>>
} & FloatingArrowSharedElementProps<T>

export type PopoverArrowElementProps = PopoverArrowSharedElementProps & {
  'data-corvu-popover-arrow': ''
} & FloatingArrowElementProps

export type PopoverArrowProps<T extends ValidComponent = 'div'> =
  PopoverArrowCorvuProps & Partial<PopoverArrowSharedElementProps<T>>

/** Arrow element that automatically points towards the floating reference. Comes with a default arrow svg, but can be overridden by providing your own as the children.
 *
 * @data `data-corvu-popover-arrow` - Present on every popover arrow element.
 */
const PopoverArrow = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, PopoverArrowProps<T>>,
) => {
  const otherProps = omit(props as PopoverArrowProps,
    'contextId',
    'ref',
  )

  const context = useInternalPopoverContext((props as PopoverArrowProps).contextId)

  return (
    <FloatingArrow<Component<PopoverArrowElementProps>>
      floatingState={context.floatingState()}
      // === SharedElementProps ===
      ref={mergeRefs(context.setArrowRef, (props as PopoverArrowProps).ref)}
      data-corvu-popover-arrow=""
      {...otherProps}
    />
  )
}

export default PopoverArrow
