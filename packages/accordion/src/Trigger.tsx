import { callEventHandler, type ElementOf } from '@corvu-next/utils/dom'
import { type Component, createEffect, createSignal, omit, onCleanup } from 'solid-js'
import { type JSX, type ValidComponent } from '@solidjs/web'
import Disclosure, {
  type TriggerCorvuProps as DisclosureTriggerCorvuProps,
  type TriggerElementProps as DisclosureTriggerElementProps,
  type TriggerSharedElementProps as DisclosureTriggerSharedElementProps,
} from '@corvu-next/disclosure'
import { dataIf } from '@corvu-next/utils'
import type { DynamicProps } from '@corvu-next/utils/dynamic'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalAccordionContext } from '@src/context'
import { useInternalAccordionItemContext } from '@src/itemContext'

export type AccordionTriggerCorvuProps = DisclosureTriggerCorvuProps

export type AccordionTriggerSharedElementProps<
  T extends ValidComponent = 'button',
> = {
  onKeyDown: JSX.EventHandlerUnion<ElementOf<T>, KeyboardEvent>
  onFocus?: JSX.EventHandlerUnion<ElementOf<T>, FocusEvent>
  disabled: boolean | undefined
} & DisclosureTriggerSharedElementProps<T>

export type AccordionTriggerElementProps =
  AccordionTriggerSharedElementProps & {
    id: string | undefined
    'aria-disabled': 'true' | undefined
    'data-disabled': '' | undefined
    'data-corvu-accordion-trigger': ''
  } & DisclosureTriggerElementProps

export type AccordionTriggerProps<T extends ValidComponent = 'button'> =
  AccordionTriggerCorvuProps & Partial<AccordionTriggerSharedElementProps<T>>

/** Button that changes the open state of the accordion item when clicked.
 *
 * @data `data-corvu-accordion-trigger` - Present on every accordion trigger element.
 * @data `data-expanded` - Present when the accordion is expanded.
 * @data `data-collapsed` - Present when the accordion is collapsed.
 * @data `data-disabled` - Present when the accordion trigger is disabled.
 */
const AccordionTrigger = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, AccordionTriggerProps<T>>,
) => {
  const typedProps = props as AccordionTriggerProps
  const otherProps = omit(
    typedProps,
    'contextId',
    'ref',
    'onKeyDown',
    'onFocus',
    'disabled',
  )
  const [triggerRef, setTriggerRef] = createSignal<HTMLElement | null>(null)

  const accordionContext = useInternalAccordionContext(typedProps.contextId)

  // Register/unregister trigger element when ref changes
  createEffect(
    () => triggerRef(),
    (trigger: HTMLElement | null) => {
      if (trigger) {
        accordionContext.registerTrigger(trigger)
        return () => accordionContext.unregisterTrigger(trigger)
      }
    },
  )

  const context = useInternalAccordionItemContext(typedProps.contextId)

  // Register triggerId on mount, unregister on dispose
  context.registerTriggerId()
  onCleanup(() => context.unregisterTriggerId())

  const onKeyDown: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (
    e,
  ) => {
    !callEventHandler(typedProps.onKeyDown, e) &&
      accordionContext.onTriggerKeyDown(e)
  }

  const onFocus: JSX.EventHandlerUnion<HTMLButtonElement, FocusEvent> = (e) => {
    callEventHandler(typedProps.onFocus, e)
    accordionContext.onTriggerFocus(e)
  }

  return (
    <Disclosure.Trigger<
      Component<
        Omit<AccordionTriggerElementProps, keyof DisclosureTriggerElementProps>
      >
    >
      // === SharedElementProps ===
      ref={mergeRefs(typedProps.ref, setTriggerRef)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      disabled={
        typedProps.disabled === true || context.disabled() || undefined
      }
      // === ElementProps ===
      id={context.triggerId()}
      contextId={typedProps.contextId}
      aria-disabled={context.disabled() ? 'true' : undefined}
      data-disabled={dataIf(context.disabled())}
      data-corvu-accordion-trigger=""
      // === Misc ===
      data-corvu-disclosure-trigger={null}
      {...otherProps}
    />
  )
}

export default AccordionTrigger
