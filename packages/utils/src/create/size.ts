import { access, type MaybeAccessor } from '@src/reactivity'
import { createEffect, createSignal } from 'solid-js'

const createSize = (props: {
  element: MaybeAccessor<HTMLElement | null>
  dimension: MaybeAccessor<'width' | 'height'>
}) => {
  const [size, setSize] = createSignal(0)

  createEffect(
    () => ({
      element: access(props.element),
      dimension: access(props.dimension),
    }),
    ({ element, dimension }) => {
      if (!element) return

      const syncSize = (el: HTMLElement) => {
        switch (dimension) {
          case 'width':
            setSize(el.offsetWidth)
            break
          case 'height':
            setSize(el.offsetHeight)
            break
        }
      }

      syncSize(element)

      const observer = new ResizeObserver(([entry]) => {
        syncSize(entry!.target as HTMLElement)
      })
      observer.observe(element)

      return () => {
        observer.disconnect()
      }
    },
  )

  return size
}

export default createSize
