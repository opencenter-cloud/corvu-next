import {
  combineStyle,
  type ElementOf,
  type Ref,
  sortByDocumentPosition,
} from '@corvu-next/utils/dom'
import {
  createEffect,
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
  fixToPrecision,
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
   * The panels still on the size the props describe for the place they hold:
   * their own `initialSize`, else the `initialSizes` entry of that place,
   * else the default. A panel registering before them moves them to the size
   * their new place is described at. A panel leaves the moment something else
   * sets sizes — `resize`, `collapse`, `expand`, a drag, a key, the
   * consumer's own `setSizes`, a panel unmounting — or when it gives a share
   * of its size to a panel joining the layout, because from then on the
   * layout is the one that was arranged, not the one the props describe.
   */
  const describedPanels = new Set<string>()

  /**
   * The panels that have registered in the frame being laid out, with the
   * layout and the described panels as they stood when that frame began. The
   * panels of one frame settle in an order nothing promises, so the frame is
   * laid out from them in document order; the frames before it are real
   * time, and what they left is what this one folds onto.
   */
  const framePanels = new Set<string>()
  let frameSizes: number[] | null = null
  let frameDescribed = new Set<string>()

  /**
   * A registration writes `panels`, and a write is staged until the frame it
   * was made in ends, so nothing reading the panel list can run before every
   * panel of that frame has registered. This effect therefore runs once a
   * frame, after its registrations: it closes the frame, and the panels of
   * the next one fold onto the layout this one leaves.
   */
  createEffect(
    () => panels(),
    () => {
      framePanels.clear()
      frameSizes = null
    },
  )

  /**
   * Called by every path that arranges the layout. None of them can be
   * answered by comparing numbers afterwards: a panel dragged back to exactly
   * its entry has still been moved, and these paths redistribute across the
   * panels they touch rather than setting one of them.
   */
  const panelsWereMoved = () => {
    describedPanels.clear()
    framePanels.clear()
    frameSizes = null
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

    sizesToIds.splice(panelIndex, 0, panelData.id)

    /**
     * How the layout a registration folded is written.
     *
     * Where panels gave room to the panels that joined, the fold fills the
     * root: the sizes the panels joined at are the ones that were asked for,
     * the panels that gave room are derived from them, and the step carries
     * what the rounding leaves. Where their bounds would not let them give
     * that much, the layout cannot give the panels that joined the size they
     * asked for: they take what is left instead, like a resize the other
     * panels' bounds cut short, so every panel is derived.
     *
     * Where nothing gave room, the fold is the layout the panels describe,
     * rounded into the sizes they may rest at. One short of the root stays as
     * it is. One the bounds put over the root — entries of the consumer's
     * that sum past it, a panel asking for more than the room that is left,
     * or a bound raising a panel — holds every panel a bound raised at that
     * bound, since that is the one size it may have, and the panels no bound
     * raised share what is over within their own bounds. None of them is on
     * the size the props describe afterwards.
     */
    const layoutWithinBounds = (
      foldedSizes: number[],
      panelsThatGaveRoom: Set<number>,
    ) => {
      const constraints = panelsInLayout.map((layoutPanel) =>
        panelSizeConstraints(layoutPanel, rootSize()),
      )

      if (panelsThatGaveRoom.size > 0) {
        const joinedLayout = fixLayoutToPrecision({
          sizes: foldedSizes,
          constraints,
          requested: foldedSizes
            .map((size, panel) => ({ panel, size }))
            .filter(({ panel }) => !panelsThatGaveRoom.has(panel)),
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
        return fixLayoutToPrecision({
          sizes: foldedSizes,
          constraints,
          requested: [],
        })
      }

      const fixedSizes = fixSizesToPrecision(foldedSizes, constraints)
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

      // A bound raised a panel when its size is above the size the fold gave
      // it, read at the places sizes are kept at: rounding a size up to the
      // last place is not a bound, and a panel it moved is not holding
      // anywhere.
      describedPanels.clear()
      return fixLayoutToPrecision({
        sizes: fixedSizes,
        constraints,
        requested: fixedSizes
          .map((size, panel) => ({ panel, size }))
          .filter(
            ({ panel }) =>
              fixedSizes[panel]! > fixToPrecision(foldedSizes[panel]!),
          ),
      })
    }

    setSizes((sizes) => {
      // The layout already carries a size for this panel: a controlled
      // `sizes` describes every panel, including the ones still to register.
      // Adding one here is what turned a two-panel layout into three.
      if (sizes.length > registeredPanels) return sizes

      // The panels of one frame settle in an order nothing promises, so the
      // frame is laid out from its panels in document order; the frames
      // before it are real time, and the layout they left is what this one
      // folds onto. Every registration of the frame folds the whole frame
      // again, so the layout never depends on which of them settled last.
      if (frameSizes === null) {
        frameSizes = sizes
        frameDescribed = new Set(describedPanels)
      }
      framePanels.add(panelData.id)

      // Under a controlled root the sizes are the consumer's to set, so no
      // panel is on a size the props describe.
      const described =
        localProps.sizes !== undefined ? new Set<string>() : new Set(frameDescribed)
      if (localProps.sizes === undefined) {
        for (const id of framePanels) described.add(id)
      }

      // corvu's rule for the size a panel is described at, unchanged: its own
      // `initialSize`, else the `initialSizes` entry of its place, else the
      // default. The consumer indexed `initialSizes` by the layout, so the
      // place is the one the panel holds in the sorted list.
      const describedSize = (layoutPanel: PanelInstance, index: number) =>
        layoutPanel.data.initialSize !== null
          ? resolveSize(layoutPanel.data.initialSize, rootSize())
          : localProps.initialSizes[index] !== undefined
            ? resolveSize(localProps.initialSizes[index]!, rootSize())
            : 0.5

      // The layout the frame began with. A panel still on a described size
      // takes the one its place is described at now, since the panels
      // registering before it moved its place; every other panel keeps the
      // size the frames before this one left it at.
      const foldedPanels = panelsInLayout.filter(
        (layoutPanel) => !framePanels.has(layoutPanel.data.id),
      )
      let foldedSizes = foldedPanels.map((layoutPanel, index) =>
        described.has(layoutPanel.data.id)
          ? describedSize(layoutPanel, panelsInLayout.indexOf(layoutPanel))
          : frameSizes![index]!,
      )

      // Each panel of the frame then joins that layout in document order, by
      // corvu's own rule for a panel joining: it takes the size it is
      // described at, and where the panels already there fill the root they
      // each give an equal share of it. A panel that gave a share is not on a
      // described size any more.
      const panelsThatGaveRoom = new Set<string>()
      for (const layoutPanel of panelsInLayout) {
        if (!framePanels.has(layoutPanel.data.id)) continue
        const place = panelsInLayout.indexOf(layoutPanel)
        const index = foldedPanels.filter(
          (foldedPanel) => panelsInLayout.indexOf(foldedPanel) < place,
        ).length
        const joiningSize = describedSize(layoutPanel, index)
        const foldedTotalSize = foldedSizes.reduce(
          (totalSize, size) => totalSize + size,
          0,
        )
        // Every stored size is kept to `PRECISION` places, so the total of a
        // full layout of n panels can sit up to n * 10 ** -PRECISION away
        // from 1: three thirds are stored as `0.333333` and sum to
        // `0.999999`, and a drag leaves the same kind of remainder. A layout
        // is full when its total is within that, and comparing with 1 would
        // read a full layout as one still being built and let the next panel
        // join on top of it.
        if (
          foldedSizes.length > 0 &&
          Math.abs(foldedTotalSize - 1) <=
            foldedSizes.length * 10 ** -PRECISION
        ) {
          const offsetPerPanel =
            (foldedTotalSize - (1 - joiningSize)) / foldedSizes.length
          foldedSizes = foldedSizes.map((size) => size - offsetPerPanel)
          for (const givingPanel of foldedPanels) {
            panelsThatGaveRoom.add(givingPanel.data.id)
            described.delete(givingPanel.data.id)
          }
        }
        foldedSizes.splice(index, 0, joiningSize)
        foldedPanels.splice(index, 0, layoutPanel)
      }

      describedPanels.clear()
      for (const id of described) describedPanels.add(id)

      return layoutWithinBounds(
        foldedSizes,
        new Set(
          panelsInLayout
            .map((layoutPanel, index) =>
              panelsThatGaveRoom.has(layoutPanel.data.id) ? index : -1,
            )
            .filter((index) => index !== -1),
        ),
      )
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
    // The panels that stay share what the one that left gave up, so none of
    // them is on a size the props describe any more.
    panelsWereMoved()
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
        requested: [],
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
