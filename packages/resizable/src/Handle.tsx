import {
  callEventHandler,
  combineStyle,
  type ElementOf,
  type Ref,
} from '@corvu-next/utils/dom'
import {
  createEffect,
  createMemo,
  createSignal,
  omit,
  Show,
} from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import type {
  DragTarget,
  Handle,
  HandleCallbacks,
  HoverState,
} from '@src/lib/types'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { fixToPrecision, resolveSize, splitPanels } from '@src/lib/utils'
import { registerHandle, unregisterHandle } from '@src/lib/handleManager'
import { dataIf } from '@corvu-next/utils'
import { mergeDefaults, mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalResizableContext } from '@src/context'

export type ResizableHandleCorvuProps = {
  /**
   * Whether the handle is allowed to intersect with another handle at its start (Left/Top of the handle)
   * @defaultValue `true`
   */
  startIntersection?: boolean
  /**
   * Whether the handle is allowed to intersect with another handle at its end (Right/Bottom of the handle)
   * @defaultValue `true`
   */
  endIntersection?: boolean
  /**
   * Whether Alt key resize mode is enabled. Set to `'only'` to make it the default  and only way to resize.
   * @defaultValue `true`
   */
  altKey?: boolean | 'only'
  /**
   * Callback fired when the handle starts being dragged. Can be prevented by calling `event.preventDefault`.
   */
  onHandleDragStart?: (event: PointerEvent) => void
  /**
   * Callback fired when the handle is being dragged. Can be prevented by calling `event.preventDefault`.
   */
  onHandleDrag?: (event: CustomEvent) => void
  /**
   * Callback fired when the handle stops being dragged.
   */
  onHandleDragEnd?: (event: PointerEvent | TouchEvent | MouseEvent) => void
  /**
   * The `id` of the resizable context to use.
   */
  contextId?: string
}

export type ResizableHandleSharedElementProps<
  T extends ValidComponent = 'button',
> = {
  ref: Ref<ElementOf<T>>
  style: string | JSX.CSSProperties
  disabled: boolean | undefined
  onBlur: JSX.EventHandlerUnion<ElementOf<T>, FocusEvent>
  onFocus: JSX.EventHandlerUnion<ElementOf<T>, FocusEvent>
  onKeyDown: JSX.EventHandlerUnion<ElementOf<T>, KeyboardEvent>
  onKeyUp: JSX.EventHandlerUnion<ElementOf<T>, KeyboardEvent>
  onMouseEnter: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
  onMouseLeave: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
  onPointerDown: JSX.EventHandlerUnion<ElementOf<T>, PointerEvent>
  children: JSX.Element
}

export type ResizableHandleElementProps = ResizableHandleSharedElementProps & {
  role: 'separator'
  'aria-orientation': 'horizontal' | 'vertical'
  'data-active': '' | undefined
  'data-dragging': '' | undefined
  'data-orientation': 'horizontal' | 'vertical'
  'data-corvu-resizable-handle': ''
}

export type ResizableHandleProps<T extends ValidComponent = 'button'> =
  ResizableHandleCorvuProps & Partial<ResizableHandleSharedElementProps<T>>

/** Resizable handle.
 *
 * @data `data-corvu-resizable-handle` - Present on every resizable handle.
 * @data `data-active` - Present when the handle is active.
 * @data `data-dragging` - Present when the handle is being dragged.
 * @data `data-orientation` - The orientation of the resizable.
 */
const ResizableHandle = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, ResizableHandleProps<T>>,
) => {
  const defaultedProps = mergeDefaults(
    {
      startIntersection: true,
      endIntersection: true,
      altKey: true,
    },
    props as ResizableHandleProps,
  )

  const localProps = defaultedProps
  const otherProps = omit(defaultedProps,
    'startIntersection',
    'endIntersection',
    'altKey',
    'onHandleDragStart',
    'onHandleDrag',
    'onHandleDragEnd',
    'contextId',
    'ref',
    'style',
    'disabled',
    'children',
    'onMouseEnter',
    'onMouseLeave',
    'onKeyDown',
    'onKeyUp',
    'onFocus',
    'onBlur',
    'onPointerDown',
  )

  const [ref, setRef] = createSignal<HTMLElement | null>(null)

  const [hoveredAsIntersection, setHoveredAsIntersection] = createSignal(false)
  const [hovered, setHovered] = createSignal<HoverState>(null)
  const [focused, setFocused] = createSignal(false)

  const [active, setActive] = createSignal(false)
  const [dragging, setDragging] = createSignal(false)

  const [startIntersectionHandle, setStartIntersectionHandle] =
    createSignal<Handle | null>(null)
  const [endIntersectionHandle, setEndIntersectionHandle] =
    createSignal<Handle | null>(null)

  const context = useInternalResizableContext(localProps.contextId)

  const ariaInformation = createMemo(
    () => {
      const handle = ref()
      if (!handle) {
        return undefined
      }
      const panels = context.panels()
      const [precidingPanels, followingPanels] = splitPanels({
        panels,
        focusedElement: handle,
      })
      const ariaControls = precidingPanels[precidingPanels.length - 1]?.data.id
      const ariaValueMax = followingPanels.reduce(
        (acc, panel) =>
          acc - resolveSize(panel.data.minSize, context.rootSize()),
        1,
      )
      const ariaValueMin = precidingPanels.reduce(
        (acc, panel) =>
          acc + resolveSize(panel.data.minSize, context.rootSize()),
        0,
      )
      const ariaValueNow = precidingPanels.reduce(
        (acc, panel) => acc + resolveSize(panel.size(), context.rootSize()),
        0,
      )

      return {
        ariaControls,
        ariaValueMax: fixToPrecision(ariaValueMax),
        ariaValueMin: fixToPrecision(ariaValueMin),
        ariaValueNow: fixToPrecision(ariaValueNow),
      }
    },
    {
      // The four values, not the object carrying them: the memo rebuilds it
      // whenever the panels, their sizes or the root's size change, and most
      // of those changes leave the handle standing where it stood. Without
      // this gate every one of them would re-run the effect that writes the
      // attributes.
      equals: (prev, next) =>
        prev?.ariaControls === next?.ariaControls &&
        prev?.ariaValueMax === next?.ariaValueMax &&
        prev?.ariaValueMin === next?.ariaValueMin &&
        prev?.ariaValueNow === next?.ariaValueNow,
    },
  )

  /** The aria values are measurements of where the mounted handle sits
   *  between the panels, so they are applied to the element rather than
   *  handed to the spread beside the ref that measures it: the spread applies
   *  a ref and the attributes next to it in one effect, so attributes derived
   *  from that ref make the effect re-run on its own write
   *  (`EFFECT_WRITES_OWN_SOURCE`) — two flushes, with the handle in the
   *  document carrying no aria values in between. These four are corvu's own
   *  and no longer among the element props, so nothing else writes them. */
  createEffect(
    () => ({ element: ref(), aria: ariaInformation() }),
    ({ element, aria }) => {
      if (!element) return
      setAttribute(element, 'aria-controls', aria?.ariaControls)
      setAttribute(element, 'aria-valuemax', aria?.ariaValueMax)
      setAttribute(element, 'aria-valuemin', aria?.ariaValueMin)
      setAttribute(element, 'aria-valuenow', aria?.ariaValueNow)
    },
  )

  let globalHandleCallbacks: HandleCallbacks | null = null

  /** The handle's registration in the global handle list. `registerHandle`
   *  pairs the handle with the touching handles of other resizables and
   *  writes THEIR `startIntersectionHandle` / `endIntersectionHandle`
   *  signals, so it belongs in the effect's callback, where a write to
   *  another owner's signal is an imperative one the next flush carries —
   *  from the compute it would be a write made while a computation is
   *  running (`REACTIVE_WRITE_IN_OWNED_SCOPE`).
   *
   *  Everything reactive the registration needs therefore comes through the
   *  compute, the two intersection flags included: `setHandle` reads them
   *  when `registerHandle` calls it, which is now inside the callback, where
   *  reading a prop would be an untracked read of reactive state. */
  createEffect(
    () => ({
      element: localProps.disabled === true ? null : ref(),
      orientation: context.orientation(),
      altKey: localProps.altKey,
      startIntersection: localProps.startIntersection,
      endIntersection: localProps.endIntersection,
    }),
    (registration) => {
      const element = registration.element
      if (!element) return

      const globalHandle: Handle = {
        element,
        orientation: registration.orientation,
        handleCursorStyle: context.handleCursorStyle,
        altKey: registration.altKey,
        startIntersection: {
          handle: startIntersectionHandle,
          setHandle: (handle) => {
            if (registration.startIntersection !== true) return
            setStartIntersectionHandle(handle)
          },
        },
        endIntersection: {
          handle: endIntersectionHandle,
          setHandle: (handle) => {
            if (registration.endIntersection !== true) return
            setEndIntersectionHandle(handle)
          },
        },
        hovered,
        focused,
        hoveredAsIntersection,
        setHoveredAsIntersection,
        active,
        setActive,
        dragging,
        setDragging,
        onDrag: (delta: number, altKey: boolean) => {
          if (localProps.onHandleDrag !== undefined) {
            const dragEvent = new CustomEvent('drag', {
              cancelable: true,
            })
            localProps.onHandleDrag(dragEvent)
            if (dragEvent.defaultPrevented) return
          }
          context.onDrag(element, delta, altKey)
        },
        onDragEnd: (event) => {
          localProps.onHandleDragEnd?.(event)
          context.onDragEnd()
        },
      }

      globalHandleCallbacks = registerHandle(globalHandle)

      return () => {
        unregisterHandle(globalHandle)
        globalHandleCallbacks = null
      }
    },
  )

  const setHoveredAndNotify = (state: HoverState) => {
    setHovered(state)
    globalHandleCallbacks?.onHoveredChange(state)
  }

  const onMouseEnter: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (
    e,
  ) => {
    if (
      callEventHandler(localProps.onMouseEnter, e) ||
      localProps.disabled === true
    )
      return
    setHoveredAndNotify('handle')
  }
  const onMouseLeave: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (
    e,
  ) => {
    if (callEventHandler(localProps.onMouseLeave, e)) return
    setHoveredAndNotify(null)
  }
  const onKeyDown: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (
    e,
  ) => {
    if (callEventHandler(localProps.onKeyDown, e) || dragging()) return
    const element = ref()
    if (!element) return
    const altKey =
      localProps.altKey === 'only' || (localProps.altKey !== false && e.altKey)
    context.onKeyDown(element, e, altKey)
  }
  const onKeyUp: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (
    e,
  ) => {
    if (callEventHandler(localProps.onKeyUp, e) || e.key !== 'Tab') return
    setFocused(true)
  }
  const onFocus: JSX.EventHandlerUnion<HTMLButtonElement, FocusEvent> = (e) => {
    if (callEventHandler(localProps.onFocus, e) || hovered()) return
    setFocused(true)
    setActive(true)
  }
  const onBlur: JSX.EventHandlerUnion<HTMLButtonElement, FocusEvent> = (e) => {
    if (callEventHandler(localProps.onBlur, e)) return
    setFocused(false)
    if (hovered()) return
    setActive(false)
  }
  const onPointerDown: JSX.EventHandlerUnion<
    HTMLButtonElement,
    PointerEvent
  > = (e) => {
    if (callEventHandler(localProps.onPointerDown, e)) return
    if (callEventHandler(localProps.onHandleDragStart, e)) return
    const targetElement = e.target as HTMLElement
    targetElement.setPointerCapture(e.pointerId)

    let target: DragTarget = 'handle'
    if (
      targetElement.hasAttribute(
        'data-corvu-resizable-handle-start-intersection',
      )
    ) {
      target = 'startIntersection'
    }
    if (
      targetElement.hasAttribute('data-corvu-resizable-handle-end-intersection')
    ) {
      target = 'endIntersection'
    }
    globalHandleCallbacks?.onDragStart(e, target)
  }

  return (
    <Dynamic<ResizableHandleElementProps>
      as="button"
      // === SharedElementProps ===
      ref={mergeRefs(setRef, localProps.ref)}
      style={combineStyle(
        {
          position: 'relative',
          cursor: context.handleCursorStyle() ? 'inherit' : undefined,
          'touch-action': 'none',
          'flex-shrink': 0,
        },
        localProps.style,
      )}
      disabled={localProps.disabled}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={onPointerDown}
      // === ElementProps ===
      role="separator"
      aria-orientation={context.orientation()}
      data-active={dataIf(active())}
      data-dragging={dataIf(dragging())}
      data-orientation={context.orientation()}
      data-corvu-resizable-handle=""
      {...otherProps}
    >
      <Show when={startIntersectionHandle()}>
        <div
          data-corvu-resizable-handle-start-intersection
          onMouseEnter={() => setHoveredAndNotify('startIntersection')}
          onMouseLeave={(e) => {
            if (ref()?.contains(e.relatedTarget as HTMLElement) === true) {
              setHoveredAndNotify('handle')
            } else {
              setHoveredAndNotify(null)
            }
          }}
          style={{
            position: 'absolute',
            'aspect-ratio': '1 / 1',
            top: 0,
            left: 0,
            height:
              context.orientation() === 'horizontal' ? undefined : '100%',
            width:
              context.orientation() === 'horizontal' ? '100%' : undefined,
            transform:
              context.orientation() === 'horizontal'
                ? 'translate3d(0, -100%, 0)'
                : 'translate3d(-100%, 0, 0)',
            'z-index': 1,
          }}
        />
      </Show>
      {localProps.children}
      <Show when={endIntersectionHandle()}>
        <div
          data-corvu-resizable-handle-end-intersection
          onMouseEnter={() => setHoveredAndNotify('endIntersection')}
          onMouseLeave={(e) => {
            if (ref()?.contains(e.relatedTarget as HTMLElement) === true) {
              setHoveredAndNotify('handle')
            } else {
              setHoveredAndNotify(null)
            }
          }}
          style={{
            position: 'absolute',
            'aspect-ratio': '1 / 1',
            bottom: 0,
            right: 0,
            height:
              context.orientation() === 'horizontal' ? undefined : '100%',
            width:
              context.orientation() === 'horizontal' ? '100%' : undefined,
            transform:
              context.orientation() === 'horizontal'
                ? 'translate3d(0, 100%, 0)'
                : 'translate3d(100%, 0, 0)',
            'z-index': 1,
          }}
        />
      </Show>
    </Dynamic>
  )
}

/** Writes an attribute, or removes it where there is no value — what Solid
 *  does with an `undefined` attribute prop. */
const setAttribute = (
  element: Element,
  name: string,
  value: string | number | undefined,
) => {
  if (value === undefined) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, String(value))
  }
}

export default ResizableHandle
