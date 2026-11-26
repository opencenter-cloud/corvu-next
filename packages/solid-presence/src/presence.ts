import { access, type MaybeAccessor } from '@corvu-next/utils/reactivity'
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js'

/**
 * Manages the presence of an element in the DOM while being aware of pending animations.
 *
 * @param props.show - Whether the presence is showing.
 * @param props.element - The element which animations should be tracked.
 * @param props.onStateChange - Callback fired when the presence state changes.
 * @returns ```typescript
 * {
 *   present: Accessor<boolean>
 * }
 * ```
 */
const createPresence = (props: {
  show: MaybeAccessor<boolean>
  element: MaybeAccessor<HTMLElement | null>
  onStateChange?: (state: 'present' | 'hiding' | 'hidden') => void
}): {
  present: Accessor<boolean>
  state: Accessor<'present' | 'hiding' | 'hidden'>
} => {
  const refStyles = createMemo(() => {
    const element = access(props.element)
    if (!element) return
    return getComputedStyle(element)
  })

  const getAnimationName = () => {
    return refStyles()?.animationName ?? 'none'
  }

  /** The animation the element last started playing, from its own
   *  `animationstart` event: plain state, because a DOM event is not a
   *  reactive source and the only reader is the state below, at the one
   *  moment `show` turns off. */
  let startedAnimationName = 'none'

  /** Whether the exit animation this hiding is waiting for has finished,
   *  with the signal beside it that tells the state to look again. The flag
   *  is plain state the listener owns; the signal carries nothing but the
   *  fact that it changed. */
  let exitAnimationEnded = false
  const [exitAnimationTick, setExitAnimationTick] = createSignal(0)

  /**
   * The presence, derived rather than kept in sync by an effect. An effect
   * that writes state readers depend on makes them run twice for one write
   * of `show` — once against the stale state, once after the write landed
   * (`EFFECT_RELAY_TEAR`) — so `<Show when={present()}>` painted the frame
   * `show` flipped in with the presence of the frame before. As a memo the
   * presence is answered in the flush `show` changes in.
   *
   * `show` decides everything but one case: turning it off while the
   * element has an exit animation to play, which keeps the element present
   * as `hiding` until the animation ends. That one case is what the
   * previous state and the listeners below are for.
   */
  const presentState = createMemo<'present' | 'hiding' | 'hidden'>((prev) => {
    const show = access(props.show)
    // Read so that the end of an exit animation re-derives the state.
    exitAnimationTick()

    if (show) {
      exitAnimationEnded = false
      return 'present'
    }
    if (prev === undefined || prev === 'hidden') return 'hidden'
    if (prev === 'hiding') return exitAnimationEnded ? 'hidden' : 'hiding'

    const currentAnimationName = getAnimationName()
    if (currentAnimationName === 'none' || refStyles()?.display === 'none') {
      return 'hidden'
    }
    // An exit animation is one the element has not started playing yet: the
    // name under the hidden state differs from the one that last started.
    if (startedAnimationName === currentAnimationName) return 'hidden'

    exitAnimationEnded = false
    return 'hiding'
  })

  /** The state the consumer has been told about. The state a presence is
   *  created in is not a change, so it is seeded here and never announced. */
  let announcedState = untrack(presentState)

  createEffect(presentState, (state) => {
    if (state === announcedState) return
    announcedState = state
    props.onStateChange?.(state)
  })

  // The element's own animation events: `animationstart` records what is
  // playing, and the end of an exit animation releases the hiding above.
  createEffect(
    () => access(props.element),
    (element) => {
      if (!element) return

      const handleAnimationStart = (event: AnimationEvent) => {
        if (event.target === element) {
          startedAnimationName = getAnimationName()
        }
      }

      const handleAnimationEnd = (event: AnimationEvent) => {
        const currentAnimationName = getAnimationName()
        const isCurrentAnimation = currentAnimationName.includes(
          event.animationName,
        )
        if (
          event.target === element &&
          isCurrentAnimation &&
          untrack(presentState) === 'hiding'
        ) {
          exitAnimationEnded = true
          setExitAnimationTick((tick) => tick + 1)
        }
      }

      element.addEventListener('animationstart', handleAnimationStart)
      element.addEventListener('animationcancel', handleAnimationEnd)
      element.addEventListener('animationend', handleAnimationEnd)

      return () => {
        element.removeEventListener('animationstart', handleAnimationStart)
        element.removeEventListener('animationcancel', handleAnimationEnd)
        element.removeEventListener('animationend', handleAnimationEnd)
      }
    },
  )

  return {
    present: () => presentState() === 'present' || presentState() === 'hiding',
    state: presentState,
  }
}

export default createPresence
