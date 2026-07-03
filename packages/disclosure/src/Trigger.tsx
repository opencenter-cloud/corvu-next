import { callEventHandler, type ElementOf } from '@corvu-next/utils/dom'
import { type Component, omit } from 'solid-js'
import { type JSX, type ValidComponent } from '@solidjs/web'
import {
  DynamicButton,
  type DynamicButtonElementProps,
  type DynamicButtonSharedElementProps,
  type DynamicProps,
} from '@corvu-next/utils/dynamic'
import { dataIf } from '@corvu-next/utils'
import { useInternalDisclosureContext } from '@src/context'

export type DisclosureTriggerCorvuProps = {
  /**
   * The `id` of the disclosure context to use.
   */
  contextId?: string
}

export type DisclosureTriggerSharedElementProps<
  T extends ValidComponent = 'button',
> = {
  onClick: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
} & DynamicButtonSharedElementProps<T>

export type DisclosureTriggerElementProps =
  DisclosureTriggerSharedElementProps & {
    'aria-controls': string
    'aria-expanded': 'true' | 'false'
    'data-collapsed': '' | undefined
    'data-expanded': '' | undefined
    'data-corvu-disclosure-trigger': '' | null
  } & DynamicButtonElementProps

export type DisclosureTriggerProps<T extends ValidComponent = 'button'> =
  DisclosureTriggerCorvuProps & Partial<DisclosureTriggerSharedElementProps<T>>

/** Button that changes the open state of the disclosure when clicked.
 *
 * @data `data-corvu-disclosure-trigger` - Present on every disclosure trigger element.
 * @data `data-expanded` - Present when the disclosure is expanded.
 * @data `data-collapsed` - Present when the disclosure is collapsed.
 */
const DisclosureTrigger = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, DisclosureTriggerProps<T>>,
) => {
  const typedProps = props as DisclosureTriggerProps
  const otherProps = omit(typedProps, 'contextId', 'onClick')

  const context = useInternalDisclosureContext(typedProps.contextId)

  const onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (e) => {
    !callEventHandler(typedProps.onClick, e) &&
      context.setExpanded((expanded) => !expanded)
  }

  return (
    <DynamicButton<
      Component<
        Omit<DisclosureTriggerElementProps, keyof DynamicButtonElementProps>
      >
    >
      // === SharedElementProps ===
      onClick={onClick}
      // === ElementProps ===
      aria-controls={context.disclosureId()}
      aria-expanded={context.expanded() ? 'true' : 'false'}
      data-collapsed={dataIf(!context.expanded())}
      data-expanded={dataIf(context.expanded())}
      data-corvu-disclosure-trigger=""
      {...otherProps}
    />
  )
}

export default DisclosureTrigger
