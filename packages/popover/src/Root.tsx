import {
  type Component,
  createSignal,
  merge,
  untrack,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import {
  createInternalPopoverContext,
  createPopoverContext,
} from '@src/context'
import Dialog, {
  type ContextValue as DialogContextValue,
  type RootChildrenProps as DialogRootChildrenProps,
  type RootProps as DialogRootProps,
} from '@corvu-next/dialog'
import type {
  FloatingOptions,
  FloatingState,
} from '@corvu-next/utils/create/floating'
import type { Placement, Strategy } from '@floating-ui/dom'
import createFloating from '@corvu-next/utils/create/floating'
import createOnce from '@corvu-next/utils/create/once'
import { isFunction } from '@corvu-next/utils'

export type PopoverRootProps = {
  /**
   * The initial placement of the popover.
   * @defaultValue `'bottom'`
   */
  placement?: Placement
  /**
   * The strategy to use when positioning the popover.
   * @defaultValue `'absolute'`
   */
  strategy?: Strategy
  /**
   * Floating options of the popover.
   * @defaultValue `{ flip: true, shift: true }`
   */
  floatingOptions?: FloatingOptions | null
  /** @hidden */
  children:
    | JSX.Element
    | ((
        props: PopoverRootChildrenProps & DialogRootChildrenProps,
      ) => JSX.Element)
} & Omit<DialogRootProps, 'children'>

/** Props that are passed to the Root component children callback. */
export type PopoverRootChildrenProps = {
  /** The initial placement of the popover. */
  placement: Placement
  /** The strategy to use when positioning the popover. */
  strategy: Strategy
  /** Floating options of the popover. */
  floatingOptions: FloatingOptions | null
  /** The current floating state of the popover. */
  floatingState: FloatingState
}

/** Context wrapper for the popover. Is required for every popover you create. */
const PopoverRoot: Component<PopoverRootProps> = (props) => {
  const defaultedProps = merge(
    {
      placement: 'bottom' as const,
      strategy: 'absolute' as const,
      floatingOptions: {
        flip: true,
        shift: true,
      },
      modal: false,
      closeOnOutsidePointer: true,
    },
    props,
  )

  const [dialogContext, setDialogContext] = createSignal<
    DialogContextValue | undefined
  >(undefined, { ownedWrite: true })

  const [anchorRef, setAnchorRef] = createSignal<HTMLElement | null>(null)
  const [triggerRef, setTriggerRef] = createSignal<HTMLElement | null>(null)
  const [arrowRef, setArrowRef] = createSignal<HTMLElement | null>(null)

  const floatingState = createFloating({
    enabled: () => dialogContext()?.contentPresent() ?? false,
    floating: () => dialogContext()?.contentRef() ?? null,
    reference: () => anchorRef() ?? triggerRef() ?? null,
    arrow: arrowRef,
    placement: () => defaultedProps.placement,
    strategy: () => defaultedProps.strategy,
    options: () => defaultedProps.floatingOptions,
  })

  const childrenProps: PopoverRootChildrenProps = {
    get placement() {
      return defaultedProps.placement
    },
    get strategy() {
      return defaultedProps.strategy
    },
    get floatingOptions() {
      return defaultedProps.floatingOptions
    },
    get floatingState() {
      return floatingState()
    },
  }

  const memoizedChildren = createOnce(() => defaultedProps.children)

  const resolveChildren = (dialogChildrenProps: DialogRootChildrenProps) => {
    setDialogContext(Dialog.useContext(defaultedProps.contextId))

    const children = memoizedChildren()()
    if (isFunction(children)) {
      const mergedProps = merge(dialogChildrenProps, childrenProps)
      return children(mergedProps)
    }
    return children
  }

  const PopoverContext = createPopoverContext(defaultedProps.contextId)
  const InternalPopoverContext = createInternalPopoverContext(
    defaultedProps.contextId,
  )
  return (
    <PopoverContext
      value={{
        placement: () => defaultedProps.placement,
        strategy: () => defaultedProps.strategy,
        floatingOptions: () => defaultedProps.floatingOptions,
        floatingState,
      }}
    >
      <InternalPopoverContext
        value={{
          placement: () => defaultedProps.placement,
          strategy: () => defaultedProps.strategy,
          floatingOptions: () => defaultedProps.floatingOptions,
          floatingState,
          setAnchorRef,
          setTriggerRef,
          setArrowRef,
        }}
      >
        <Dialog contextId={defaultedProps.contextId} {...props}>
          {(dialogChildrenProps) => resolveChildren(dialogChildrenProps)}
        </Dialog>
      </InternalPopoverContext>
    </PopoverContext>
  ) as unknown as JSX.Element
}

export default PopoverRoot
