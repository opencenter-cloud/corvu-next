import { combineStyle, type ElementOf, type Ref } from '@corvu-next/utils/dom'
import { createMemo, omit, Show } from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { mergeRefs, some } from '@corvu-next/utils/reactivity'
import { dataIf } from '@corvu-next/utils'
import Dismissible from '@corvu-next/dismissible'
import { getFloatingStyle } from '@corvu-next/utils/floating'
import type { Placement } from '@floating-ui/dom'
import { useInternalTooltipContext } from '@src/context'

export type TooltipContentCorvuProps = {
  /**
   * Whether the tooltip content should be forced to render. Useful when using third-party animation libraries.
   * @defaultValue `false`
   */
  forceMount?: boolean
  /**
   * The `id` of the tooltip context to use.
   */
  contextId?: string
}

export type TooltipContentSharedElementProps<T extends ValidComponent = 'div'> =
  {
    ref: Ref<ElementOf<T>>
    style: string | JSX.CSSProperties
  }

export type TooltipContentElementProps = TooltipContentSharedElementProps & {
  id: string
  role: 'tooltip'
  'data-closed': '' | undefined
  'data-open': '' | undefined
  'data-placement': Placement
  'data-corvu-tooltip-content': ''
}

export type TooltipContentProps<T extends ValidComponent = 'div'> =
  TooltipContentCorvuProps & Partial<TooltipContentSharedElementProps<T>>

/** Content of the tooltip. Can be animated.
 *
 * @data `data-corvu-tooltip-content` - Present on every tooltip content element.
 * @data `data-open` - Present when the tooltip is open.
 * @data `data-closed` - Present when the tooltip is closed.
 * @data `data-placement` - Current placement of the tooltip.
 */
const TooltipContent = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, TooltipContentProps<T>>,
) => {
  const otherProps = omit(props as TooltipContentProps,
    'forceMount',
    'contextId',
    'ref',
    'style',
  )

  const context = useInternalTooltipContext((props as TooltipContentProps).contextId)

  const show = () =>
    some(context.open, () => (props as TooltipContentProps).forceMount, context.contentPresent)

  const enableDismissible = createMemo(
    () => context.open() || context.contentPresent(),
  )

  return (
    <Dismissible
      element={context.contentRef}
      enabled={enableDismissible()}
      dismissibleId={context.tooltipId()}
      onDismiss={() => context.setOpen(false)}
      dismissOnEscapeKeyDown={context.closeOnEscapeKeyDown}
      dismissOnOutsideFocus={false}
      dismissOnOutsidePointer={false}
      noOutsidePointerEvents={false}
      onEscapeKeyDown={context.onEscapeKeyDown}
    >
      {(dismissibleProps) => (
        <Show when={show()}>
          <Dynamic<TooltipContentElementProps>
            as="div"
            // === SharedElementProps ===
            ref={mergeRefs(context.setContentRef, (props as TooltipContentProps).ref)}
            style={combineStyle(
              {
                ...getFloatingStyle({
                  strategy: () => context.strategy(),
                  floatingState: () => context.floatingState(),
                })(),
                'pointer-events': dismissibleProps.isLastLayer ? 'auto' : undefined,
              },
              (props as TooltipContentProps).style,
            )}
            // === ElementProps ===
            id={context.tooltipId()}
            role="tooltip"
            data-closed={dataIf(!context.open())}
            data-open={dataIf(context.open())}
            data-placement={context.floatingState().placement}
            data-corvu-tooltip-content=""
            {...otherProps}
          />
        </Show>
      )}
    </Dismissible>
  )
}

export default TooltipContent
