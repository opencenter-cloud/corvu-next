import { access, type MaybeAccessor } from '@corvu-next/utils/reactivity'
import { type Accessor, createEffect, createSignal } from 'solid-js'
import { afterPaint } from '@corvu-next/utils/dom'

/**
 * Utility that uses a `ResizeObserver` to provide the size of an element before and after resize. Used to transition the width/height of elements that don't have a fixed size applied.
 *
 * @param props.element - The element to transition.
 * @param props.enabled - Whether the utility is enabled. *Default = `true`*
 * @param props.dimension - The dimension to transition. *Default = `'both'`*
 * @returns ```typescript
 * {
 *   transitioning: () => boolean
 *   transitionSize: () => number | [number, number] | null
 * }
 * ```
 */
function createTransitionSize(props: {
  element: MaybeAccessor<HTMLElement | null>
  enabled?: MaybeAccessor<boolean>
  dimension?: MaybeAccessor<'both'>
}): {
  transitioning: Accessor<boolean>
  transitionSize: Accessor<[number, number] | null>
}
function createTransitionSize(props: {
  element: MaybeAccessor<HTMLElement | null>
  enabled?: MaybeAccessor<boolean>
  dimension: MaybeAccessor<'width' | 'height'>
}): {
  transitioning: Accessor<boolean>
  transitionSize: Accessor<number | null>
}
function createTransitionSize(props: {
  element: MaybeAccessor<HTMLElement | null>
  enabled?: MaybeAccessor<boolean>
  dimension?: MaybeAccessor<'width' | 'height' | 'both'>
}): {
  transitioning: Accessor<boolean>
  transitionSize: Accessor<number | [number, number] | null>
} {
  const [transitioning, setTransitioning] = createSignal(false)
  const [transitionSize, setTransitionSize] = createSignal<
    number | [number, number] | null
  >(null)

  let startSize: [number, number] | null = null

  createEffect(() => {
    const element = access(props.element)
    const enabled = access(props.enabled ?? true)
    if (!element || !enabled) return

    const observer = new ResizeObserver(resizeObserverCallback)
    observer.observe(element)

    element.addEventListener('transitionend', reset)

    return () => {
      observer.disconnect()
      element.removeEventListener('transitionend', reset)
      reset()
    }
  })

  const resizeObserverCallback = ([entry]: ResizeObserverEntry[]) => {
    if (transitioning()) return
    const target = entry!.target as HTMLElement
    const currentSize: [number, number] = [
      target.offsetWidth,
      target.offsetHeight,
    ]
    const dimension = access(props.dimension ?? 'both')
    if (dimension === 'both') {
      if (!startSize) {
        startSize = currentSize
      } else if (
        startSize[0] !== currentSize[0] &&
        startSize[1] !== currentSize[1]
      ) {
        setTransitionSize(startSize)
        setTransitioning(true)
        afterPaint(() => {
          setTransitionSize(currentSize)
          const transitionDuration = parseFloat(
            getComputedStyle(entry!.target).transitionDuration,
          )
          if (transitionDuration === 0) {
            reset()
          }
        })
      }
    } else {
      if (!startSize) {
        startSize = currentSize
      } else if (
        getSizeOfDimension(dimension, startSize) !==
        getSizeOfDimension(dimension, currentSize)
      ) {
        setTransitionSize(getSizeOfDimension(dimension, startSize!))
        setTransitioning(true)
        afterPaint(() => {
          setTransitionSize(getSizeOfDimension(dimension, currentSize))
          const transitionDuration = parseFloat(
            getComputedStyle(entry!.target).transitionDuration,
          )
          if (transitionDuration === 0) {
            reset()
          }
        })
      }
    }
  }

  const reset = () => {
    if (!transitioning()) return
    const element = access(props.element)
    if (element) {
      startSize = [element.offsetWidth, element.offsetHeight]
    } else {
      startSize = null
    }
    setTransitioning(false)
    setTransitionSize(null)
  }

  return {
    transitioning,
    transitionSize,
  }
}

const getSizeOfDimension = (
  dimension: 'width' | 'height',
  size: [number, number],
) => {
  switch (dimension) {
    case 'width':
      return size[0]
    case 'height':
      return size[1]
  }
}

export default createTransitionSize
