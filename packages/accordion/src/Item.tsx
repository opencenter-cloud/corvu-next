import {
  createAccordionItemContext,
  createInternalAccordionItemContext,
} from '@src/itemContext'
import {
  createMemo,
  createUniqueId,
  merge,
  omit,
} from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import type {
  RootChildrenProps as DisclosureRootChildrenProps,
  RootProps as DisclosureRootProps,
  DynamicProps,
} from '@corvu-next/disclosure'
import createOnce from '@corvu-next/utils/create/once'
import createRegister from '@corvu-next/utils/create/register'
import Disclosure from '@corvu-next/disclosure'
import { Dynamic } from '@corvu-next/utils/dynamic'
import Fragment from '@corvu-next/utils/components/Fragment'
import { isFunction } from '@corvu-next/utils'
import { useInternalAccordionContext } from '@src/context'

export type AccordionItemCorvuProps = {
  /**
   * Value of the accordion item.
   * @defaultValue `createUniqueId()`
   */
  value?: string
  /**
   * Whether the accordion item is disabled. Used to override the default provided by `<Accordion.Root>`.
   */
  disabled?: boolean
  /**
   * The `id` attribute of the accordion item trigger element.
   * @defaultValue `createUniqueId()`
   */
  triggerId?: string
} & Omit<
  DisclosureRootProps,
  'expanded' | 'onExpandedChange' | 'initialExpanded' | 'children'
>

export type AccordionItemSharedElementProps<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  T extends ValidComponent = typeof Fragment,
> = {
  children:
    | JSX.Element
    | ((
        props: AccordionItemChildrenProps & DisclosureRootChildrenProps,
      ) => JSX.Element)
}

export type AccordionItemElementProps = AccordionItemSharedElementProps & {
  'data-corvu-accordion-item': ''
}

export type AccordionItemProps<T extends ValidComponent = typeof Fragment> =
  AccordionItemCorvuProps & Partial<AccordionItemSharedElementProps<T>>

/** Props that are passed to the Item component children callback. */
export type AccordionItemChildrenProps = {
  /** Value of the accordion item. */
  value: string
  /** Whether the accordion item is disabled. */
  disabled: boolean
  /** The `id` attribute of the accordion item trigger element. */
  triggerId: string | undefined
}

/** Context wrapper for the accordion item. Is required for every accordion item you create.
 *
 * @data `data-corvu-accordion-item` - Present if the item isn't rendered as a Fragment.
 */
const AccordionItem = <T extends ValidComponent = typeof Fragment>(
  props: DynamicProps<T, AccordionItemProps<T>>,
) => {
  const defaultedProps = merge(
    {
      accordionId: createUniqueId(),
    },
    props,
  )
  const typedProps = defaultedProps as AccordionItemProps
  const otherProps = omit(
    typedProps,
    'value',
    'disabled',
    'collapseBehavior',
    'preventInitialContentAnimation',
    'triggerId',
    'contextId',
    'children',
  )

  const [triggerId, registerTriggerId, unregisterTriggerId] = createRegister({
    value: () => typedProps.triggerId ?? createUniqueId(),
  })

  const context = createMemo(() =>
    useInternalAccordionContext(typedProps.contextId),
  )

  const value = createMemo(() => typedProps.value ?? createUniqueId())

  const expanded = createMemo(() => context().internalValue().includes(value()))
  const disabled = createMemo(
    () => (typedProps.disabled ?? context().disabled()) as boolean,
  )
  const collapseBehavior = createMemo(
    () => typedProps.collapseBehavior ?? context().collapseBehavior(),
  )
  const preventInitialContentAnimation = createMemo(
    () =>
      typedProps.preventInitialContentAnimation ??
      context().preventInitialContentAnimation(),
  )

  const childrenProps: AccordionItemChildrenProps = {
    get value() {
      return value()
    },
    get disabled() {
      return disabled()
    },
    get triggerId() {
      return triggerId()
    },
  }

  const memoizedChildren = createOnce(() => typedProps.children)

  const resolveChildren = (
    disclosureChildrenProps: DisclosureRootChildrenProps,
  ) => {
    const children = memoizedChildren()()
    if (isFunction(children)) {
      const mergedProps = merge(disclosureChildrenProps, childrenProps)
      return children(mergedProps)
    }
    return children
  }

  const memoizedAccordionItem = createMemo(() => {
    const AccordionItemContext = createAccordionItemContext(
      typedProps.contextId,
    )
    const InternalAccordionItemContext = createInternalAccordionItemContext(
      typedProps.contextId,
    )

    return (
      <AccordionItemContext
        value={{
          value,
          disabled,
          triggerId,
        }}
      >
        <InternalAccordionItemContext
          value={{
            value,
            disabled,
            triggerId,
            registerTriggerId,
            unregisterTriggerId,
          }}
        >
          <Dynamic<AccordionItemElementProps>
            as={Fragment}
            // === ElementProps ===
            data-corvu-accordion-item=""
            {...otherProps}
          >
            <Disclosure
              expanded={expanded()}
              onExpandedChange={(newExpanded) => {
                if (newExpanded === expanded() || disabled()) return
                context().toggleValue(value())
              }}
              collapseBehavior={collapseBehavior()}
              preventInitialContentAnimation={preventInitialContentAnimation()}
              contextId={typedProps.contextId}
              {...otherProps}
            >
              {(disclosureChildrenProps) =>
                resolveChildren(disclosureChildrenProps)
              }
            </Disclosure>
          </Dynamic>
        </InternalAccordionItemContext>
      </AccordionItemContext>
    )
  })

  return memoizedAccordionItem as unknown as JSX.Element
}

export default AccordionItem
