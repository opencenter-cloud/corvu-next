import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  merge,
  omit,
  untrack,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createDrawerContext, createInternalDrawerContext } from '@src/context'
import type {
  ContextValue as DialogContextValue,
  RootChildrenProps as DialogRootChildrenProps,
  RootProps as DialogRootProps,
} from '@corvu-next/dialog'
import { isFunction, type Side, type Size } from '@corvu-next/utils'
import { afterPaint } from '@corvu-next/utils/dom'
import createControllableSignal from '@corvu-next/utils/create/controllableSignal'
import createOnce from '@corvu-next/utils/create/once'
import createSize from '@corvu-next/utils/create/size'
import createTransitionSize from '@corvu-next/transition-size'
import Dialog from '@corvu-next/dialog'
import { resolveSnapPoint } from '@src/lib'

export type DrawerRootProps = {
  /**
   * An array of points to snap to. Can be either percentages of the total drawer height or CSS pixel values.
   * @defaultValue `[0, 1]`
   */
  snapPoints?: Size[]
  /**
   * Optionally override the default breakpoints between snap points. This list has to be the length of `snapPoints.length - 1`. Provide `null` for breakpoints you don't want to override.
   */
  breakPoints?: (Size | null)[]
  /**
   * The point to snap to when the drawer opens.
   * @defaultValue `1`
   */
  defaultSnapPoint?: Size
  /**
   * The active snap point.
   */
  activeSnapPoint?: Size
  /**
   * Callback fired when the active snap point changes.
   */
  onActiveSnapPointChange?: (activeSnapPoint: Size) => void
  /**
   * The side of the viewport the drawer appears. Is used to properly calculate dragging.
   * @defaultValue `'bottom'`
   */
  side?: Side
  /**
   * Function to create a dampened distance if the user tries to drag the drawer away from the last snap point.
   */
  dampFunction?: (distance: number) => number
  /**
   * Function to calculate the velocity when the user stop dragging. This velocity modifier is used to calculate the point the drawer will snap to after release. You can disable velocity by always returning 1
   */
  velocityFunction?: (distance: number, time: number) => number
  /**
   * After how many milliseconds the cached distance used for the velocity function should reset.
   * @defaultValue `200`
   */
  velocityCacheReset?: number
  /**
   * Whether the user can skip snap points if the velocity is high enough.
   * @defaultValue `true`
   */
  allowSkippingSnapPoints?: boolean
  /**
   * corvu drawers have logic to make dragging and scrolling work together. If you don't want this behavior or if you want to implement something yourself, you can disable it with this property.
   * @defaultValue `true`
   */
  handleScrollableElements?: boolean
  /**
   * Whether the drawer should watch for size changes and apply a fixed width/height for transitions.
   * @defaultValue `false`
   */
  transitionResize?: boolean
  /** @hidden */
  children:
    | JSX.Element
    | ((
        props: DrawerRootChildrenProps & DialogRootChildrenProps,
      ) => JSX.Element)
} & Omit<DialogRootProps, 'children'>

/** Props that are passed to the Root component children callback. */
export type DrawerRootChildrenProps = {
  /** An array of points to snap to. Can be either percentages of the total drawer height or CSS pixel values. */
  snapPoints: Size[]
  /** Breakpoints between snap points. */
  breakPoints: (Size | null)[]
  /** The point to snap to when the drawer opens. */
  defaultSnapPoint: Size
  /** The active snap point. */
  activeSnapPoint: Size
  /** Set the current active snap point. */
  setActiveSnapPoint: (snapPoint: Size) => void
  /** The side of the viewport the drawer appears. Is used to properly calculate dragging. */
  side: Side
  /** Whether the drawer is currently being dragged by the user. */
  isDragging: boolean
  /** Whether the drawer is currently transitioning to a snap point after the user stopped dragging or the drawer opens/closes. */
  isTransitioning: boolean
  /** The transition state that the drawer is currently in. */
  transitionState: 'opening' | 'closing' | 'snapping' | 'resizing' | null
  /** How much the drawer is currently open. Can be > 1 depending on your `dampFunction`. */
  openPercentage: number
  /** The current translate value applied to the drawer. Is the same for every side. */
  translate: number
  /** After how many milliseconds the cached distance used for the velocity function should reset. */
  velocityCacheReset: number
  /** Whether the user can skip snap points if the velocity is high enough. */
  allowSkippingSnapPoints: boolean
  /** Whether the logic to handle dragging on scrollable elements is enabled. */
  handleScrollableElements: boolean
  /** Whether the drawer watches for size changes and applies a fixed width/height for transitions. */
  transitionResize: boolean
}

type TransitionState = 'opening' | 'closing' | 'snapping' | 'resizing' | null

/** Context wrapper for the drawer. Is required for every drawer you create. */
const DrawerRoot: Component<DrawerRootProps> = (props) => {
  const defaultedProps = merge(
    {
      initialOpen: false,
      snapPoints: [0, 1],
      breakPoints: [null],
      defaultSnapPoint: 1,
      side: 'bottom' as const,
      dampFunction: (distance: number) => 6 * Math.log(distance + 1),
      velocityFunction: (distance: number, time: number) => {
        const velocity = distance / time
        return velocity < 1 && velocity > -1 ? 1 : velocity
      },
      velocityCacheReset: 200,
      allowSkippingSnapPoints: true,
      handleScrollableElements: true,
      transitionResize: false,
      closeOnOutsidePointer: true,
      allowPinchZoom: false,
    },
    props,
  )

  // omit returns the "rest" props that get passed to <Dialog>
  const otherProps = omit(defaultedProps,
    'snapPoints',
    'breakPoints',
    'defaultSnapPoint',
    'activeSnapPoint',
    'onActiveSnapPointChange',
    'side',
    'dampFunction',
    'velocityFunction',
    'velocityCacheReset',
    'allowSkippingSnapPoints',
    'handleScrollableElements',
    'transitionResize',
    'open',
    'initialOpen',
    'onOpenChange',
    'closeOnOutsidePointer',
    'contextId',
    'children',
  )

  const [open, setOpen] = createControllableSignal({
    value: () => defaultedProps.open,
    initialValue: defaultedProps.initialOpen,
    onChange: defaultedProps.onOpenChange,
  })

  const [activeSnapPoint, setActiveSnapPoint] = createControllableSignal({
    value: () => defaultedProps.activeSnapPoint,
    initialValue: 0,
    onChange: defaultedProps.onActiveSnapPointChange,
  })

  const [dialogContext, setDialogContext] = createSignal<DialogContextValue>()

  const { transitioning: sizeTransitioning, transitionSize } =
    createTransitionSize({
      element: () => dialogContext()?.contentRef() ?? null,
      enabled: () => open() && defaultedProps.transitionResize,
      dimension: () => {
        switch (defaultedProps.side) {
          case 'top':
          case 'bottom':
            return 'height'
          case 'left':
          case 'right':
            return 'width'
        }
      },
    })

  const [isDragging, setIsDragging] = createSignal(false)

  // Solid 2 derived signal: createSignal(fn) for derived-but-writable state.
  // Replaces createWritableMemo from @solid-primitives/memo.
  const [transitionState, setTransitionState] = createSignal<TransitionState>(
    (): TransitionState => {
      if (sizeTransitioning()) return 'resizing'
      return null
    },
  )

  const drawerStyles = createMemo(() => {
    const contentRef = dialogContext()?.contentRef()
    if (!contentRef) return undefined
    return getComputedStyle(contentRef)
  })

  const [transitionAwareOpen, setTransitionAwareOpen] = createSignal(false)

  createEffect(
    () => open(),
    (_open) => {
      untrack(() => {
        if (transitionAwareOpen() === _open) {
          return
        }

        if (_open) {
          setTransitionAwareOpen(true)
          afterPaint(() => {
            setTransitionState('opening')
            setActiveSnapPoint(defaultedProps.defaultSnapPoint)
            const transitionDuration = parseFloat(
              drawerStyles()!.transitionDuration,
            )
            if (transitionDuration === 0) {
              setTransitionState(null)
            }
          })
        } else {
          setTransitionState('closing')
          setActiveSnapPoint(0)
          afterPaint(() => {
            const transitionDuration = parseFloat(
              drawerStyles()!.transitionDuration,
            )
            if (transitionDuration === 0) {
              closeDrawer()
            }
          })
        }
      })
    },
  )

  const closeDrawer = () => {
    setTransitionAwareOpen(false)
    setTransitionState(null)
  }

  const drawerSize = createSize({
    element: () => dialogContext()?.contentRef() ?? null,
    dimension: () => {
      switch (defaultedProps.side) {
        case 'top':
        case 'bottom':
          return 'height'
        case 'left':
        case 'right':
          return 'width'
      }
    },
  })

  const resolvedActiveSnapPoint = createMemo(() =>
    resolveSnapPoint(activeSnapPoint(), drawerSize()),
  )

  // Derived-but-writable signal: tracks resolvedActiveSnapPoint offset,
  // but can be written to during drag.
  const [translate, setTranslate] = createSignal<number>(
    (): number => resolvedActiveSnapPoint().offset,
  )

  const openPercentage = createMemo(() => {
    if (!drawerSize()) return 0
    return (drawerSize() - translate()) / drawerSize()
  })

  const childrenProps: DrawerRootChildrenProps = {
    get snapPoints() {
      return defaultedProps.snapPoints
    },
    get breakPoints() {
      return defaultedProps.breakPoints
    },
    get defaultSnapPoint() {
      return defaultedProps.defaultSnapPoint
    },
    get activeSnapPoint() {
      return activeSnapPoint()
    },
    setActiveSnapPoint,
    get side() {
      return defaultedProps.side
    },
    get isDragging() {
      return isDragging()
    },
    get isTransitioning() {
      return transitionState() !== null
    },
    get transitionState() {
      return transitionState()
    },
    get openPercentage() {
      return openPercentage()
    },
    get translate() {
      return translate()
    },
    get velocityCacheReset() {
      return defaultedProps.velocityCacheReset
    },
    get allowSkippingSnapPoints() {
      return defaultedProps.allowSkippingSnapPoints
    },
    get handleScrollableElements() {
      return defaultedProps.handleScrollableElements
    },
    get transitionResize() {
      return defaultedProps.transitionResize
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

  const memoizedDrawerRoot = createMemo(() => {
    const DrawerContext = createDrawerContext(defaultedProps.contextId)
    const InternalDrawerContext = createInternalDrawerContext(
      defaultedProps.contextId,
    )

    return untrack(() => (
      <DrawerContext
        value={{
          snapPoints: () => defaultedProps.snapPoints,
          breakPoints: () => defaultedProps.breakPoints,
          defaultSnapPoint: () => defaultedProps.defaultSnapPoint,
          activeSnapPoint,
          setActiveSnapPoint,
          side: () => defaultedProps.side,
          isDragging,
          isTransitioning: () => transitionState() !== null,
          transitionState,
          openPercentage,
          translate,
          velocityCacheReset: () => defaultedProps.velocityCacheReset,
          allowSkippingSnapPoints: () => defaultedProps.allowSkippingSnapPoints,
          handleScrollableElements: () =>
            defaultedProps.handleScrollableElements,
          transitionResize: () => defaultedProps.transitionResize,
        }}
      >
        <InternalDrawerContext
          value={{
            snapPoints: () => defaultedProps.snapPoints,
            breakPoints: () => defaultedProps.breakPoints,
            defaultSnapPoint: () => defaultedProps.defaultSnapPoint,
            activeSnapPoint,
            setActiveSnapPoint,
            side: () => defaultedProps.side,
            isDragging,
            isTransitioning: () => transitionState() !== null,
            transitionState,
            openPercentage,
            translate,
            velocityCacheReset: () => defaultedProps.velocityCacheReset,
            allowSkippingSnapPoints: () =>
              defaultedProps.allowSkippingSnapPoints,
            handleScrollableElements: () =>
              defaultedProps.handleScrollableElements,
            transitionResize: () => defaultedProps.transitionResize,
            dampFunction: defaultedProps.dampFunction,
            velocityFunction: defaultedProps.velocityFunction,
            setIsDragging,
            setTranslate,
            drawerSize,
            resolvedActiveSnapPoint,
            drawerStyles,
            setTransitionState,
            transitionSize,
            closeDrawer,
          }}
        >
          <Dialog
            open={transitionAwareOpen()}
            onOpenChange={setOpen}
            contextId={defaultedProps.contextId}
            closeOnOutsidePointer={
              !isDragging() && defaultedProps.closeOnOutsidePointer
            }
            {...otherProps}
          >
            {(dialogChildrenProps) => resolveChildren(dialogChildrenProps)}
          </Dialog>
        </InternalDrawerContext>
      </DrawerContext>
    ))
  })

  return memoizedDrawerRoot as unknown as JSX.Element
}

export default DrawerRoot
