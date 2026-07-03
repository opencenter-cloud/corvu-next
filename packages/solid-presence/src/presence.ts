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

  // Initial read of `props.show` is a one-shot seed for the signal, not a
  // reactive dependency. Wrap in `untrack` so Solid 2's strict mode does not
  // flag it with STRICT_READ_UNTRACKED. Subsequent updates flow through the
  // createEffect below, which reads `props.show` inside a tracked compute.
  const [presentState, setPresentStateInternal] = createSignal<
    'present' | 'hiding' | 'hidden'
  >(untrack(() => access(props.show)) ? 'present' : 'hidden')

  const setPresentState = (state: 'present' | 'hiding' | 'hidden') => {
    setPresentStateInternal(state)
    props.onStateChange?.(state)
  }

  let animationName = 'none'

  // Effect 1: react to `show` prop changes, compute next present state.
  // compute receives prev (undefined on first run, then the last returned value).
  // We return { prev, show } — `prev` is the previous `show` value.
  createEffect(
    (prevResult: { prev: boolean; show: boolean } | undefined) => {
      const show = access(props.show)
      const prev = prevResult?.show ?? show
      return { prev, show }
    },
    ({ prev, show }) => {
      if (prev === show) return

      untrack(() => {
        const prevAnimationName = animationName
        const currentAnimationName = getAnimationName()

        if (show) {
          setPresentState('present')
        } else if (
          currentAnimationName === 'none' ||
          refStyles()?.display === 'none'
        ) {
          setPresentState('hidden')
        } else {
          const isAnimating = prevAnimationName !== currentAnimationName

          if (prev === true && isAnimating) {
            setPresentState('hiding')
          } else {
            setPresentState('hidden')
          }
        }
      })
    },
  )

  // Effect 2: attach animation event listeners to the tracked element.
  // Split-phase: compute reads `element`; apply attaches listeners and returns cleanup.
  createEffect(
    () => access(props.element),
    (element) => {
      if (!element) return

      const handleAnimationStart = (event: AnimationEvent) => {
        if (event.target === element) {
          animationName = getAnimationName()
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
          presentState() === 'hiding'
        ) {
          setPresentState('hidden')
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
