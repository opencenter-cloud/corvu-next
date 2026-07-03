import { createMemo, omit, Show } from 'solid-js'
import { type ComponentProps, Portal } from '@solidjs/web'
import { some } from '@corvu-next/utils/reactivity'
import { useInternalTooltipContext } from '@src/context'

export type TooltipPortalProps = {
  /**
   * Whether the tooltip portal should be forced to render. Useful when using third-party animation libraries.
   * @defaultValue `false`
   */
  forceMount?: boolean
  /**
   * The `id` of the tooltip context to use.
   */
  contextId?: string
}

/** Portals its children at the end of the body element to ensure that the tooltip always rendered on top. */
const TooltipPortal = (
  props: TooltipPortalProps & ComponentProps<typeof Portal>,
) => {
  const otherProps = omit(props,
    'forceMount',
    'contextId',
  )

  const context = createMemo(() =>
    useInternalTooltipContext(props.contextId),
  )

  const show = () =>
    some(context().open, () => props.forceMount, context().contentPresent)

  return (
    <Show when={show()}>
      <Portal {...otherProps} />
    </Show>
  )
}

export default TooltipPortal
