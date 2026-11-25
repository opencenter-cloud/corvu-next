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
import {
  fixLayoutToPrecision,
  fixSizesToPrecision,
  panelSizeConstraints,
  PRECISION,
  resolveSize,
  splitPanels,
  storedCollapsedSize,
} from '@src/lib/utils'
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
   * Whether anything has arranged the layout since the panels described it:
   * a `resize`, `collapse`, `expand`, a drag, a key, the consumer's own
   * `setSizes`, or a panel unmounting, which shares out what it gave up.
   * Until then each registration lays the whole layout out again from the
   * panels in document order, so the layout is what the panels describe and
   * not what the order they happened to settle in made of them.
   */
  let layoutWasArranged = false

  /**
   * Called by every path that arranges the layout. None of them can be
   * answered by comparing numbers afterwards: a panel dragged back to exactly
   * its entry has still been moved, and these paths redistribute across the
   * panels they touch rather than setting one of them.
   */
  const panelsWereMoved = () => {
    layoutWasArranged = true
    initialSizedPanels.clear()
  }

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
    let panelsInLayout: PanelInstance[] = []
    setPanels((panels) => {
      registeredPanels = panels.length
      const newPanels = [...panels]
      newPanels.push(panel)
      newPanels.sort((a, b) =>
        sortByDocumentPosition(a.data.element, b.data.element),
      )
      panelIndex = newPanels.indexOf(panel)
      panelsInLayout = newPanels
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

    /**
     * Bounds hold over the layout a registration lays out: every size is
     * rounded into the sizes its panel may rest at, and where that leaves the
     * layout over the root — entries of the consumer's that sum past it, a
     * panel asking for more than the room that is left, or a bound raising a
     * panel — the panel a bound raised holds there, since that is the one
     * size it may have, and every other panel shares what is over within its
     * own bounds. None of them is on its entry afterwards.
     */
    const layoutWithinBounds = (describedSizes: number[]) => {
      const constraints = panelsInLayout.map((layoutPanel) =>
        panelSizeConstraints(layoutPanel, rootSize()),
      )
      const fixedSizes = fixSizesToPrecision(describedSizes, constraints)
      const fixedTotalSize = fixedSizes.reduce(
        (totalSize, size) => totalSize + size,
        0,
      )
      // A layout short of the root is the one that was described and stays
      // as it is; one over the root never stands, not even by the place the
      // rounding leaves, since that is what a panel on top of the root is.
      if (fixedTotalSize <= 1 + 10 ** -(PRECISION + 3)) {
        return fixedSizes
      }

      const raisedPanel = fixedSizes.findIndex(
        (size, index) => size > describedSizes[index]!,
      )
      initialSizedPanels.clear()
      return fixLayoutToPrecision({
        sizes: fixedSizes,
        constraints,
        requestedPanel: raisedPanel === -1 ? null : raisedPanel,
        requestedSize: raisedPanel === -1 ? null : fixedSizes[raisedPanel]!,
      })
    }

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


      // Nothing has arranged the layout yet, so it is still the one the
      // panels describe. Lay it out again from the panels in document order,
      // applying the same rule to each of them in turn as a panel joining
      // the layout: its own `initialSize`, else its `initialSizes` entry,
      // else the default, with the panels already there giving an equal
      // share of it when they fill the root. That is what corvu lays out
      // when the panels register in document order, which is what they did
      // on Solid 1, and it depends on the sorted list rather than on which
      // panel of a frame this runtime settled last.
      if (!layoutWasArranged) {
        let describedSizes: number[] = []
        panelsInLayout.forEach((layoutPanel, index) => {
          const describedSize =
            layoutPanel.data.initialSize !== null
              ? resolveSize(layoutPanel.data.initialSize, rootSize())
              : localProps.initialSizes[index] !== undefined
                ? resolveSize(localProps.initialSizes[index]!, rootSize())
                : 0.5
          const describedTotalSize = describedSizes.reduce(
            (totalSize, size) => totalSize + size,
            0,
          )
          if (
            describedSizes.length > 0 &&
            Math.abs(describedTotalSize - 1) <=
              describedSizes.length * 10 ** -PRECISION
          ) {
            const offsetPerPanel = describedSize / describedSizes.length
            describedSizes = describedSizes.map((size) => size - offsetPerPanel)
          }
          describedSizes.push(describedSize)
        })
        return layoutWithinBounds(describedSizes)
      }
      const newSizes = [...sizes]
      const previousTotalSize = newSizes.reduce(
        (totalSize, size) => totalSize + size,
        0,
      )
      // Every stored size is kept to `PRECISION` places, so the total of a
      // full layout of n panels can sit up to n * 10 ** -PRECISION away from
      // 1: three thirds are stored as `0.333333` and sum to `0.999999`, and a
      // drag leaves the same kind of remainder. A layout is full when its
      // total is within that, and comparing with 1 would read a full layout
      // as one still being built and let the next panel join on top of it.
      const layoutIsFull =
        newSizes.length > 0 &&
        Math.abs(previousTotalSize - 1) <= newSizes.length * 10 ** -PRECISION

      if (layoutIsFull) {
        // A full layout has no room for another panel, so the panels there
        // each give up an equal share of the size it takes. Nothing follows
        // `initialSizes` through that, since every entry is the layout from
        // before.
        initialSizedPanels.clear()
        const offsetPerPanel =
          (previousTotalSize - (1 - panelSize!)) / newSizes.length
        const sizesWithRoom = newSizes.map((size) => size - offsetPerPanel)
        sizesWithRoom.splice(panelIndex, 0, panelSize!)
        const constraints = panelsInLayout.map((panel) =>
          panelSizeConstraints(panel, rootSize()),
        )

        const joinedLayout = fixLayoutToPrecision({
          sizes: sizesWithRoom,
          constraints,
          requestedPanel: panelIndex,
          requestedSize: panelSize!,
        })
        const joinedTotalSize = joinedLayout.reduce(
          (totalSize, size) => totalSize + size,
          0,
        )
        if (
          Math.abs(joinedTotalSize - 1) <=
          joinedLayout.length * 10 ** -PRECISION
        ) {
          return joinedLayout
        }

        // Their bounds would not let them give that share, so the layout
        // cannot give the panel that joined the size it asked for. It takes
        // what is left instead, like a resize the other panels' bounds cut
        // short: nobody's size is given here, so every panel is derived.
        return fixLayoutToPrecision({
          sizes: sizesWithRoom,
          constraints,
          requestedPanel: null,
          requestedSize: null,
        })
      }

      newSizes.splice(panelIndex, 0, panelSize!)

      // A layout still being built is not shared out: the entries the
      // consumer gave are the layout they described. Nothing follows
      // `initialSizes` under a controlled root, where the sizes are theirs to
      // set.
      if (localProps.sizes !== undefined) {
        initialSizedPanels.clear()
      } else {
        for (const id of initialSizedPanels) {
          const index = sizesToIds.indexOf(id)
          const initialSize = localProps.initialSizes[index]
          if (initialSize === undefined) {
            initialSizedPanels.delete(id)
            continue
          }
          newSizes[index] = resolveSize(initialSize, rootSize())
        }
      }

      return layoutWithinBounds(newSizes)
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
    // The panels that stay share what the one that left gave up, so the
    // layout is no longer the one the panels describe.
    layoutWasArranged = true
    initialSizedPanels.delete(id)
    let panelsInLayout: PanelInstance[] = []
    setPanels((panels) => {
      panelsInLayout = panels.filter((panel) => panel.data.id !== id)
      return panelsInLayout
    })
    const panelSizeIndex = sizesToIds.indexOf(id)
    sizesToIds.splice(panelSizeIndex, 1)
    setSizes((sizes) => {
      const newSizes = [...sizes]
      newSizes.splice(panelSizeIndex, 1)
      if (newSizes.length === 0) return newSizes
      // The panels that stay share the size the one that left gave up, and
      // they share it the one way a full layout is written: no panel passes
      // its own bounds, a collapsed one stays collapsed rather than being
      // opened by a share it never asked for, and the last panel standing is
      // the whole layout. Nobody asked for a size here, so every panel is
      // derived.
      return fixLayoutToPrecision({
        sizes: newSizes,
        constraints: panelsInLayout.map((panel) =>
          panelSizeConstraints(panel, rootSize()),
        ),
        requestedPanel: null,
        requestedSize: null,
      })
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
        requestedSize: allowedSize,
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
      const collapsedSize = storedCollapsedSize(
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
        requestedSize: collapsedSize,
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
      const collapsedSize = storedCollapsedSize(
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
        requestedSize: minSize,
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
      const collapsedSize = storedCollapsedSize(
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
