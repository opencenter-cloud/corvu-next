import { access, type MaybeAccessor } from '@src/reactivity'
import { createEffect, createMemo, createSignal } from 'solid-js'

/**
 * The measured size of an element, in the dimension asked for.
 *
 * An element's size exists only after layout, so it is read from the element
 * rather than computed from the graph — but it is still DERIVED from it: the
 * memo measures whatever element it is pointed at, and the observer below
 * marks the measurement stale when the browser resizes it. Measuring from an
 * effect instead would make every reader of the size settle one flush behind
 * the element it describes.
 */
const createSize = (props: {
  element: MaybeAccessor<HTMLElement | null>
  dimension: MaybeAccessor<'width' | 'height'>
}) => {
  /** Bumped for each size the observer reports. The sizes themselves are not
   *  carried here: the memo reads the element it is pointed at now, and this
   *  says only that the element has been laid out again. The write is the
   *  observer's, made from a browser callback rather than from the graph. */
  const [resizes, setResizes] = createSignal(0, { name: 'resizes' })

  createEffect(
    () => access(props.element),
    (element) => {
      if (!element) return

      const observer = new ResizeObserver(() => setResizes((count) => count + 1))
      observer.observe(element)

      return () => observer.disconnect()
    },
  )

  return createMemo(
    () => {
      resizes()
      const element = access(props.element)
      if (!element) return 0
      return access(props.dimension) === 'width'
        ? element.offsetWidth
        : element.offsetHeight
    },
    { name: 'size' },
  )
}

export default createSize
