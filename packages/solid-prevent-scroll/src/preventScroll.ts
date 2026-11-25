/**!
 * Part of this code is inspired by react-remove-scroll.
 * MIT License, Copyright (c) Anton Korzunov
 *
 * https://github.com/theKashey/react-remove-scroll
 */

import {
  access,
  type MaybeAccessor,
  mergeDefaults,
} from '@corvu-next/utils/reactivity'
import {
  type Accessor,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  untrack,
} from 'solid-js'
import type { Axis } from '@corvu-next/utils'
import { contains } from '@corvu-next/utils/dom'
import createStyle from '@corvu-next/utils/create/style'
import { getScrollAtLocation } from '@corvu-next/utils/scroll'

/** One utility on the page, and whether it is preventing scroll right now.
 *  `enabled` is read where the stack is read, so a utility turning on or off
 *  is in the stack in that flush: a stack an effect wrote instead made every
 *  reader run twice for one write of `enabled` (`EFFECT_RELAY_TEAR`), the
 *  first time against the stack as it was. */
type PreventScrollRegistration = {
  id: string
  enabled: Accessor<boolean>
}

const [preventScrollRegistrations, setPreventScrollRegistrations] =
  createSignal<PreventScrollRegistration[]>([], { ownedWrite: true })

/** Whether this utility is the innermost one preventing scroll: only that
 *  one listens, so the listeners of the dialog behind a dialog do nothing. */
const isActive = (id: string) => {
  const enabled = preventScrollRegistrations().filter((entry) =>
    entry.enabled(),
  )
  return enabled[enabled.length - 1]?.id === id
}

/** Everything the body-style effect's apply phase styles the body from. */
type BodyStyleInput = {
  enabled: boolean
  hideScrollbar: boolean
  preventScrollbarShift: boolean
  preventScrollbarShiftMode: 'padding' | 'margin'
}

/**
 * Prevents scroll outside of the given element.
 *
 * @param props.element - Prevent scroll outside of this element. If the element is `null`, scroll will be prevented on the whole page. *Default = `null`*
 * @param props.enabled - Whether scroll should be prevented. *Default = `true`*
 * @param props.hideScrollbar - Whether the scrollbar of the `<body>` element should be hidden. *Default = `true`*
 * @param props.preventScrollbarShift - Whether padding should be added to the `<body>` element to avoid layout shift. *Default = `true`*
 * @param props.preventScrollbarShiftMode - Whether padding or margin should be used to avoid layout shift. *Default = `'padding'`*
 * @param props.restoreScrollPosition - Whether to restore the `<body>` scroll position with `window.scrollTo` to avoid possible layout shift after disabling the utility. *Default = `true`*
 * @param props.allowPinchZoom - Whether pinch zoom should be allowed. *Default = `false`*
 */
const createPreventScroll = (props: {
  element?: MaybeAccessor<HTMLElement | null>
  enabled?: MaybeAccessor<boolean>
  hideScrollbar?: MaybeAccessor<boolean>
  preventScrollbarShift?: MaybeAccessor<boolean>
  preventScrollbarShiftMode?: MaybeAccessor<'padding' | 'margin'>
  restoreScrollPosition?: MaybeAccessor<boolean>
  allowPinchZoom?: MaybeAccessor<boolean>
}) => {
  const defaultedProps = mergeDefaults(
    {
      element: null,
      enabled: true,
      hideScrollbar: true,
      preventScrollbarShift: true,
      preventScrollbarShiftMode: 'padding',
      restoreScrollPosition: true,
      allowPinchZoom: false,
    },
    props,
  )

  const preventScrollId = createUniqueId()

  let currentTouchStart: [number, number] = [0, 0]
  let currentTouchStartAxis: Axis | null = null
  let currentTouchStartDelta: number | null = null

  // This utility's place in the stack, for as long as it lives.
  const registration: PreventScrollRegistration = {
    id: preventScrollId,
    enabled: () => access(props.enabled ?? true),
  }
  setPreventScrollRegistrations((registrations) => [
    ...registrations,
    registration,
  ])
  onCleanup(() =>
    setPreventScrollRegistrations((registrations) =>
      registrations.filter((entry) => entry !== registration),
    ),
  )

  // Effect 2: Body style application (scrollbar hide + shift compensation)
  createEffect(
    (prev: undefined | BodyStyleInput): BodyStyleInput => {
      const enabled = access(props.enabled ?? true)
      const hideScrollbar = access(props.hideScrollbar ?? true)
      // The apply phase below is a strict-read window: a consumer's reactive
      // `preventScrollbarShift` or `preventScrollbarShiftMode` read there is a
      // `STRICT_READ_UNTRACKED`, and a change to it would not restyle the
      // body. Both are read here, so the body's style follows them.
      const preventScrollbarShift = access(
        defaultedProps.preventScrollbarShift,
      )
      // The default widens the literal union to `string`, and only the two
      // words the prop declares ever reach it.
      const preventScrollbarShiftMode = access(
        defaultedProps.preventScrollbarShiftMode,
      ) as 'padding' | 'margin'
      return {
        enabled,
        hideScrollbar,
        preventScrollbarShift,
        preventScrollbarShiftMode,
      }
    },
    (next: BodyStyleInput, prev?: BodyStyleInput) => {
      if (!next.enabled || !next.hideScrollbar) {
        return
      }

      const { body } = document

      const scrollbarWidth = window.innerWidth - body.offsetWidth

      if (next.preventScrollbarShift) {
        const style: Partial<CSSStyleDeclaration> = { overflow: 'hidden' }
        const properties: { key: string; value: string }[] = []

        if (scrollbarWidth > 0) {
          if (next.preventScrollbarShiftMode === 'padding') {
            style.paddingRight = `calc(${
              window.getComputedStyle(body).paddingRight
            } + ${scrollbarWidth}px)`
          } else {
            style.marginRight = `calc(${
              window.getComputedStyle(body).marginRight
            } + ${scrollbarWidth}px)`
          }

          properties.push({
            key: '--scrollbar-width',
            value: `${scrollbarWidth}px`,
          })
        }

        const offsetTop = window.scrollY
        const offsetLeft = window.scrollX

        const revertStyle = createStyle({
          key: 'prevent-scroll',
          element: body,
          style,
          properties,
          cleanup: () => {
            // Whether to restore the scroll position is decided when the
            // style is reverted, not when it was applied, and this runs in a
            // cleanup, which tracks nothing: `untrack` says so, so a reactive
            // value here is read as the plain lookup it is.
            const restoreScrollPosition = untrack(() =>
              access(defaultedProps.restoreScrollPosition),
            )
            if (restoreScrollPosition && scrollbarWidth > 0) {
              window.scrollTo(offsetLeft, offsetTop)
            }
          },
        })
        return () => {
          revertStyle()
        }
      } else {
        const revertStyle = createStyle({
          key: 'prevent-scroll',
          element: body,
          style: {
            overflow: 'hidden',
          },
        })
        return revertStyle
      }
    },
  )

  // Effect 3: Wheel/touch listener attachment
  createEffect(
    (prev: undefined | { active: boolean; enabled: boolean }) => {
      const active = isActive(preventScrollId)
      const enabled = access(props.enabled ?? true)
      return { active, enabled }
    },
    (
      next: { active: boolean; enabled: boolean },
      prev?: { active: boolean; enabled: boolean },
    ) => {
      if (!next.active || !next.enabled) return

      document.addEventListener('wheel', maybePreventWheel, {
        passive: false,
      })
      document.addEventListener('touchstart', logTouchStart, {
        passive: false,
      })
      document.addEventListener('touchmove', maybePreventTouch, {
        passive: false,
      })

      return () => {
        document.removeEventListener('wheel', maybePreventWheel)
        document.removeEventListener('touchstart', logTouchStart)
        document.removeEventListener('touchmove', maybePreventTouch)
      }
    },
  )

  const logTouchStart = (event: TouchEvent) => {
    currentTouchStart = getTouchXY(event)
    currentTouchStartAxis = null
    currentTouchStartDelta = null
  }

  const maybePreventWheel = (event: WheelEvent) => {
    const target = event.target as HTMLElement
    const wrapper = access(defaultedProps.element)

    const delta = getDeltaXY(event as WheelEvent)
    const axis = Math.abs(delta[0]) > Math.abs(delta[1]) ? 'x' : 'y'
    const axisDelta = axis === 'x' ? delta[0] : delta[1]

    const resultsInScroll = wouldScroll(target, axis, axisDelta, wrapper)
    let shouldCancel: boolean
    if (wrapper && contains(wrapper, target)) {
      shouldCancel = !resultsInScroll
    } else {
      shouldCancel = true
    }
    if (shouldCancel && event.cancelable) {
      event.preventDefault()
    }
  }

  const maybePreventTouch = (event: TouchEvent) => {
    const wrapper = access(defaultedProps.element)
    const target = event.target as HTMLElement

    let shouldCancel: boolean

    // Two touch points = pinch zoom
    if (event.touches.length === 2) {
      shouldCancel = !access(defaultedProps.allowPinchZoom)
    } else {
      if (currentTouchStartAxis == null || currentTouchStartDelta === null) {
        const delta = getTouchXY(event).map(
          (touch, i) => currentTouchStart[i]! - touch,
        ) as [number, number]
        const axis = Math.abs(delta[0]) > Math.abs(delta[1]) ? 'x' : 'y'

        currentTouchStartAxis = axis
        currentTouchStartDelta = axis === 'x' ? delta[0] : delta[1]
      }

      // Allow touch on range inputs
      if ((target as HTMLInputElement).type === 'range') {
        shouldCancel = false
      } else {
        const wouldResultInScroll = wouldScroll(
          target,
          currentTouchStartAxis,
          currentTouchStartDelta,
          wrapper,
        )
        if (wrapper && contains(wrapper, target)) {
          shouldCancel = !wouldResultInScroll
        } else {
          shouldCancel = true
        }
      }
    }

    if (shouldCancel && event.cancelable) {
      event.preventDefault()
    }
  }
}

const getDeltaXY = (event: WheelEvent): [number, number] => [
  event.deltaX,
  event.deltaY,
]

const getTouchXY = (event: TouchEvent): [number, number] =>
  event.changedTouches[0]
    ? [event.changedTouches[0].clientX, event.changedTouches[0].clientY]
    : [0, 0]

/**
 * Checks whether a certain delta on a target would result in scrolling on the given axis.
 *
 * @param target - The target element.
 * @param delta - The delta to check.
 * @param axis - The axis to check.
 * @param wrapper - The wrapper element. If the target is contained in the wrapper, the function will check if it would scroll inside the wrapper
 * @returns Whether the delta would result in scrolling on the given axis.
 */
const wouldScroll = (
  target: HTMLElement,
  axis: Axis,
  delta: number,
  wrapper: HTMLElement | null,
) => {
  const targetInWrapper = wrapper !== null && contains(wrapper, target)

  const [availableScroll, availableScrollTop] = getScrollAtLocation(
    target,
    axis,
    targetInWrapper ? wrapper : undefined,
  )

  // On firefox, availableScroll can be 1 even if there is no scroll available.
  if (delta > 0 && Math.abs(availableScroll) <= 1) {
    return false
  }
  if (delta < 0 && Math.abs(availableScrollTop) < 1) {
    return false
  }

  return true
}

export default createPreventScroll
