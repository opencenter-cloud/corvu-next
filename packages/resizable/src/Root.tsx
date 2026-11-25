import {
  combineStyle,
  type ElementOf,
  type Ref,
  sortByDocumentPosition,
} from '@corvu-next/utils/dom'
import {
  createSignal,
  getOwner,
  isDisposed,
  merge,
  type Setter,
  omit,
  untrack,
} from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import {
  createInternalResizableContext,
  createResizableContext,
} from '@src/context'
import { deltaResize, resizePanel } from '@src/lib/resize'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { isFunction, type Size } from '@corvu-next/utils'
import type { PanelData, PanelInstance, ResizeStrategy } from '@src/lib/types'
import { fixToPrecision, resolveSize, splitPanels } from '@src/lib/utils'
import createControllableSignal from '@corvu-next/utils/create/controllableSignal'
import createOnce from '@corvu-next/utils/create/once'
import createSize from '@corvu-next/utils/create/size'
import { mergeRefs } from '@corvu-next/utils/reactivity'

export type ResizableRootCorvuProps = {
  /**
   * The orientation of the resizable.
   * @defaultValue 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical'
  /**
   * Panel sizes in percentage.
   */
  sizes?: number[]
  /**
   * Callback fired when the panel sizes change.
   */
  onSizesChange?: (sizes: number[]) => void
  /**
   * Initial panel sizes. Gets overridden by the `initialSize` prop on `<Panel />` components.
   */
  initialSizes?: Size[]
  /**
   * The delta to use when resizing with arrow keys.
   * @defaultValue 0.1
   */
  keyboardDelta?: Size
  /**
   * Whether to handle the cursor style when resizing.
   * @defaultValue true
   */
  handleCursorStyle?: boolean
  /**
   * The `id` of the resizable context to use.
   */
  contextId?: string
}

export type ResizableRootSharedElementProps<T extends ValidComponent = 'div'> =
  {
    ref: Ref<ElementOf<T>>
    style: string | JSX.CSSProperties
    children: JSX.Element | ((props: ResizableRootChildrenProps) => JSX.Element)
  }

export type ResizableRootElementProps = ResizableRootSharedElementProps & {
  'data-orientation': 'horizontal' | 'vertical'
  'data-corvu-resizable-root': ''
}

export type ResizableRootProps<T extends ValidComponent = 'div'> =
  ResizableRootCorvuProps & Partial<ResizableRootSharedElementProps<T>>

export type ResizableRootChildrenProps = {
  /** The orientation of the resizable. */
  orientation: 'vertical' | 'horizontal'
  /** The sizes of the panels. */
  sizes: number[]
  /** Change the sizes of the panels. */
  setSizes: Setter<number[]>
  /** The delta to use when resizing with arrow keys. */
  keyboardDelta: Size
  /** Whether to handle the cursor style when resizing. */
  handleCursorStyle: boolean
  /** Resize a panel to a specific size with the given strategy. */
  resize: (panelIndex: number, size: Size, strategy?: ResizeStrategy) => void
  /** Collapse a panel with the given strategy. Only works if `collapsible` is set to `true`. */
  collapse: (panelIndex: number, strategy?: ResizeStrategy) => void
  /** Expand a panel with the given strategy. Only works if `collapsible` is set to `true`. */
  expand: (panelIndex: number, strategy?: ResizeStrategy) => void
}

/** Wrapper for the resizable.
 *
 * @data `data-corvu-resizable-root` - Present on every resizable root element.
 * @data `data-orientation` - The orientation of the resizable.
 */
const ResizableRoot = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, ResizableRootProps<T>>,
) => {
  const defaultedProps = merge(
    {
      orientation: 'horizontal' as const,
      initialSizes: [],
      keyboardDelta: 0.1,
      handleCursorStyle: true,
    },
    props as ResizableRootProps,
  )

  const localProps = defaultedProps
  const otherProps = omit(defaultedProps,
    'orientation',
    'sizes',
    'onSizesChange',
    'initialSizes',
    'keyboardDelta',
    'handleCursorStyle',
    'contextId',
    'ref',
    'style',
    'children',
  )

  const owner = getOwner()

  const [sizes, setSizes] = createControllableSignal<number[]>({
    value: () => localProps.sizes,
    initialValue: [],
    // Every write builds a fresh array, so compare the sizes themselves: a
    // layout pass that lands on the same numbers is not a change to report.
    equals: (prev, next) =>
      prev !== undefined &&
      prev.length === next.length &&
      prev.every((size, index) => size === next[index]),
    // The one place the consumer is told about a size change, so a change is
    // reported exactly once and a value they passed in through `sizes` is
    // never echoed back at them. Nothing is reported once the root itself is
    // disposed: its panels unregister as they unmount, and that bookkeeping
    // would otherwise hand the consumer the leftovers of a layout that no
    // longer exists.
    onChange: (newSizes) => {
      if (owner !== null && isDisposed(owner)) return
      localProps.onSizesChange?.(newSizes)
    },
    ownedWrite: true,
  })

  const [ref, setRef] = createSignal<HTMLElement | null>(null)

  const rootSize = createSize({
    element: ref,
    dimension: () =>
      localProps.orientation === 'horizontal' ? 'width' : 'height',
  })

  const [panels, setPanels] = createSignal<PanelInstance[]>([], {
    ownedWrite: true,
  })

  const sizesToIds: string[] = []

  /**
   * The panels whose size is still the entry `initialSizes` gave them. They
   * follow the layout: a panel registering before them moves them to the entry
   * of their new place. A panel leaves the moment something else sets sizes —
   * `resize`, `collapse`, `expand`, a drag or a key — because from then on the
   * layout is the one that was asked for, not the one `initialSizes` describes.
   */
  const initialSizedPanels = new Set<string>()

  /**
   * Called by every path that arranges the layout. None of them can be
   * answered by comparing numbers afterwards: a panel dragged back to exactly
   * its entry has still been moved, and these paths redistribute across the
   * panels they touch rather than setting one of them.
   */
  const panelsWereMoved = () => initialSizedPanels.clear()

  /**
   * The setter the consumer is handed, through the children props and both
   * contexts. Sizes they set are the layout they asked for, so no panel
   * follows `initialSizes` afterwards. The resize paths here write through
   * `setSizes` and say so themselves.
   */
  const setConsumerSizes: Setter<number[]> = (
    value: number[] | ((sizes: number[]) => number[]),
  ) => {
    panelsWereMoved()
    return setSizes(value)
  }

  const registerPanel = (panelData: PanelData): PanelInstance => {
    const panel: PanelInstance = {
      data: panelData,
      size: panelSizeMemoFactory(panelData.id),
      resize: (size, strategy) =>
        resize(sizesToIds.indexOf(panelData.id), size, strategy),
      collapse: (strategy) =>
        collapse(sizesToIds.indexOf(panelData.id), strategy),
      expand: (strategy) => expand(sizesToIds.indexOf(panelData.id), strategy),
    }

    // The list is read from inside its own setter, so a panel registering in
    // the same frame as another one sees the panel that one just added. A
    // write is staged until the end of the frame, so through the accessor
    // every registrant of one frame would still see the list from before it
    // — empty — and take index 0.
    //
    // The list is kept sorted by document position, so `panelIndex` is the
    // panel's place in the layout among the panels registered so far. Nothing
    // guarantees that the panels of one frame register in that order, so a
    // panel that registers later can land before panels already in the list
    // and move them along.
    let panelIndex = 0
    let registeredPanels = 0
    setPanels((panels) => {
      registeredPanels = panels.length
      const newPanels = [...panels]
      newPanels.push(panel)
      newPanels.sort((a, b) =>
        sortByDocumentPosition(a.data.element, b.data.element),
      )
      panelIndex = newPanels.indexOf(panel)
      return newPanels
    })

    // A controlled root's sizes are the consumer's to set, so nothing follows
    // `initialSizes` there.
    const fromInitialSizes =
      localProps.sizes === undefined &&
      panelData.initialSize === null &&
      localProps.initialSizes[panelIndex] !== undefined

    let panelSize: number | null = null
    if (panelData.initialSize !== null) {
      panelSize = resolveSize(panelData.initialSize, rootSize())
    } else if (localProps.initialSizes[panelIndex] !== undefined) {
      panelSize = resolveSize(localProps.initialSizes[panelIndex]!, rootSize())
    }
    panelSize = panelSize ?? 0.5

    sizesToIds.splice(panelIndex, 0, panelData.id)

    setSizes((sizes) => {
      // The layout already carries a size for this panel: a controlled
      // `sizes` describes every panel, including the ones still to register.
      // Adding one here is what turned a two-panel layout into three.
      if (sizes.length > registeredPanels) return sizes

      // The consumer indexed `initialSizes` by the layout, which is the order
      // of the sorted list, so a panel that takes its size from there follows
      // the list: this registration re-derives the entry of every panel still
      // following, from its place in the list as it now stands.
      if (fromInitialSizes) initialSizedPanels.add(panelData.id)

      let newSizes = [...sizes]
      // The same rounding the resize paths apply, so a layout that is one
      // float short of 1 counts as the full layout it is.
      const previousTotalSize = fixToPrecision(
        newSizes.reduce((totalSize, size) => totalSize + size, 0),
      )
      // A layout that already sums to 1 has no room for another panel, so the
      // panels there each give up a share of it, and nothing is written back
      // over what they gave up: their `initialSizes` entries are the layout
      // from before, and the sum would pass 1. A layout still being built —
      // every panel of the first frame — starts below 1.
      const madeRoom = previousTotalSize === 1
      if (madeRoom) {
        const offsetPerPanel = panelSize! / newSizes.length
        // TODO: Recognize min and max sizes
        newSizes = newSizes.map((size) => size - offsetPerPanel)
      }
      newSizes.splice(panelIndex, 0, panelSize!)

      // Nothing follows `initialSizes` through a registration that took room
      // out of the layout, and nothing follows it under a controlled root:
      // there the sizes are the consumer's to set.
      if (madeRoom || localProps.sizes !== undefined) {
        initialSizedPanels.clear()
        return newSizes.map(fixToPrecision)
      }

      for (const id of initialSizedPanels) {
        const index = sizesToIds.indexOf(id)
        const initialSize = localProps.initialSizes[index]
        if (initialSize === undefined) {
          initialSizedPanels.delete(id)
          continue
        }
        newSizes[index] = resolveSize(initialSize, rootSize())
      }

      return newSizes.map(fixToPrecision)
    })

    return panel
  }

  /** Factory for panel size accessors — called by the Panel component in its own body */
  const panelSizeMemoFactory = (id: string) => {
    return () => {
      const index = sizesToIds.indexOf(id)
      return sizes()[index]!
    }
  }

  const unregisterPanel = (id: string) => {
    initialSizedPanels.delete(id)
    setPanels((panels) => panels.filter((panel) => panel.data.id !== id))
    const panelSizeIndex = sizesToIds.indexOf(id)
    sizesToIds.splice(panelSizeIndex, 1)
    setSizes((sizes) => {
      let newSizes = [...sizes]
      newSizes.splice(panelSizeIndex, 1)
      if (newSizes.length === 0) return newSizes
      const totalSize = newSizes.reduce(
        (totalSize, size) => totalSize + size,
        0,
      )
      // The panels that stay share the size the one that left gave up, so
      // they sum to 1 again: the last panel standing is the whole layout.
      const offsetPerPanel = (1 - totalSize) / newSizes.length
      // TODO: Recognize min and max sizes
      newSizes = newSizes.map((size) => size + offsetPerPanel)
      return newSizes
    })
  }

  const resize = (
    panelIndex: number,
    size: Size,
    strategy?: ResizeStrategy,
  ) => {
    untrack(() => {
      const panel = panels()[panelIndex]
      if (!panel) return
      const minSize = resolveSize(panel.data.minSize, rootSize())
      const maxSize = resolveSize(panel.data.maxSize, rootSize())
      const newSize = resolveSize(size, rootSize())
      const allowedSize = Math.max(minSize, Math.min(newSize, maxSize))
      const deltaPercentage = allowedSize - sizes()[panelIndex]!
      panelsWereMoved()

      resizePanel({
        deltaPercentage,
        strategy: strategy ?? 'both',
        panel,
        panels: panels(),
        initialSizes: panels().map((panel) => panel.size()),
        collapsible: false,
        resizableData: {
          rootSize: rootSize(),
          orientation: localProps.orientation,
          setSizes,
        },
      })
    })
  }

  const collapse = (panelIndex: number, strategy?: ResizeStrategy) => {
    untrack(() => {
      const panel = panels()[panelIndex]
      if (!panel) return

      const panelSize = sizes()[panelIndex]!
      const collapsedSize = resolveSize(
        panel.data.collapsedSize ?? 0,
        rootSize(),
      )
      if (!panel.data.collapsible || panelSize === collapsedSize) return
      panelsWereMoved()
      const deltaPercentage = collapsedSize - panelSize
      resizePanel({
        deltaPercentage,
        strategy: strategy ?? 'both',
        panel,
        panels: panels(),
        initialSizes: panels().map((panel) => panel.size()),
        collapsible: true,
        resizableData: {
          rootSize: rootSize(),
          orientation: localProps.orientation,
          setSizes,
        },
      })
    })
  }

  const expand = (panelIndex: number, strategy?: ResizeStrategy) => {
    untrack(() => {
      const panel = panels()[panelIndex]
      if (!panel) return

      const panelSize = sizes()[panelIndex]!
      const collapsedSize = resolveSize(
        panel.data.collapsedSize ?? 0,
        rootSize(),
      )
      if (!panel.data.collapsible || panelSize !== collapsedSize) return
      const minSize = resolveSize(panel.data.minSize, rootSize())
      const deltaPercentage = minSize - panelSize
      panelsWereMoved()

      resizePanel({
        deltaPercentage,
        strategy: strategy ?? 'both',
        panel,
        panels: panels(),
        initialSizes: panels().map((panel) => panel.size()),
        collapsible: true,
        resizableData: {
          rootSize: rootSize(),
          orientation: localProps.orientation,
          setSizes,
        },
      })
    })
  }

  let initialSizes: number[] | null = null
  let altKeyCache = false

  const onDrag = (handle: HTMLElement, delta: number, altKey: boolean) => {
    if (initialSizes === null || altKeyCache !== altKey) {
      initialSizes = panels().map((panel) => panel.size())
      altKeyCache = altKey
    }
    panelsWereMoved()
    deltaResize({
      deltaPercentage: delta / rootSize(),
      altKey,
      handle,
      panels: panels(),
      initialSizes,
      resizableData: {
        rootSize: rootSize(),
        handleCursorStyle: localProps.handleCursorStyle,
        orientation: localProps.orientation,
        setSizes,
      },
    })
  }

  const onKeyDown = (
    handle: HTMLElement,
    event: KeyboardEvent,
    altKey: boolean,
  ) => {
    if (event.key === 'Enter') {
      const [precedingPanels, followingPanels] = splitPanels({
        panels: panels(),
        focusedElement: handle,
      })
      let collapsiblePanel = precedingPanels[precedingPanels.length - 1]
      if (!collapsiblePanel || !collapsiblePanel.data.collapsible) {
        collapsiblePanel = followingPanels[0]
        if (!collapsiblePanel || !collapsiblePanel.data.collapsible) return
      }
      const size = collapsiblePanel.size()
      const collapsedSize = resolveSize(
        collapsiblePanel.data.collapsedSize ?? 0,
        rootSize(),
      )
      if (size === collapsedSize) {
        collapsiblePanel.expand('following')
      } else {
        collapsiblePanel.collapse('following')
      }
      return
    }

    let deltaPercentage: number | null = null
    if (
      (localProps.orientation === 'horizontal' && event.key === 'ArrowLeft') ||
      (localProps.orientation === 'vertical' && event.key === 'ArrowUp') ||
      event.key === 'Home'
    ) {
      if (event.shiftKey || event.key === 'Home') {
        deltaPercentage = -1
      } else {
        deltaPercentage = -resolveSize(localProps.keyboardDelta, rootSize())
      }
    } else if (
      (localProps.orientation === 'horizontal' && event.key === 'ArrowRight') ||
      (localProps.orientation === 'vertical' && event.key === 'ArrowDown') ||
      event.key === 'End'
    ) {
      if (event.shiftKey || event.key === 'End') {
        deltaPercentage = 1
      } else {
        deltaPercentage = resolveSize(localProps.keyboardDelta, rootSize())
      }
    }

    if (deltaPercentage === null) return

    event.preventDefault()

    const initialSizes = panels().map((panel) => panel.size())
    panelsWereMoved()

    deltaResize({
      deltaPercentage,
      altKey,
      handle,
      panels: panels(),
      initialSizes,
      resizableData: {
        rootSize: rootSize(),
        handleCursorStyle: false,
        orientation: localProps.orientation,
        setSizes,
      },
    })
  }

  const childrenProps: ResizableRootChildrenProps = {
    get sizes() {
      return sizes()
    },
    setSizes: setConsumerSizes,
    get orientation() {
      return localProps.orientation
    },
    get keyboardDelta() {
      return localProps.keyboardDelta
    },
    get handleCursorStyle() {
      return localProps.handleCursorStyle
    },
    resize,
    collapse,
    expand,
  }

  const memoizedChildren = createOnce(() => localProps.children)

  const resolveChildren = () => {
    const children = memoizedChildren()()
    if (isFunction(children)) {
      return children(childrenProps)
    }
    return children
  }

  const ResizableContext = createResizableContext(localProps.contextId)
  const InternalResizableContext = createInternalResizableContext(
    localProps.contextId,
  )
  return (
    <ResizableContext
      value={{
        sizes,
        setSizes: setConsumerSizes,
        orientation: () => localProps.orientation,
        keyboardDelta: () => localProps.keyboardDelta,
        handleCursorStyle: () => localProps.handleCursorStyle,
        resize,
        collapse,
        expand,
      }}
    >
      <InternalResizableContext
        value={{
          sizes,
          setSizes: setConsumerSizes,
          orientation: () => localProps.orientation,
          keyboardDelta: () => localProps.keyboardDelta,
          handleCursorStyle: () => localProps.handleCursorStyle,
          rootSize,
          panels,
          registerPanel,
          unregisterPanel,
          onDrag,
          onDragEnd: () => (initialSizes = null),
          onKeyDown,
          resize,
          collapse,
          expand,
        }}
      >
        <Dynamic<ResizableRootElementProps>
          as="div"
          // === SharedElementProps ===
          ref={mergeRefs(setRef, localProps.ref)}
          style={combineStyle(
            {
              display: 'flex',
              'flex-direction':
                localProps.orientation === 'horizontal' ? 'row' : 'column',
            },
            localProps.style,
          )}
          // === ElementProps ===
          data-orientation={localProps.orientation}
          data-corvu-resizable-root=""
          {...otherProps}
        >
          {untrack(() => resolveChildren())}
        </Dynamic>
      </InternalResizableContext>
    </ResizableContext>
  ) as unknown as JSX.Element
}

export default ResizableRoot
