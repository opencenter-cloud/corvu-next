import { access, type MaybeAccessor } from '@corvu-next/utils/reactivity'
import { createEffect, merge } from 'solid-js'

/**
 * Listens for the escape key to be pressed and calls the `onEscapeKeyDown` callback.
 *
 * @param props.enabled - Whether the listener is enabled. *Default = `true`*
 * @param props.onEscapeKeyDown - Callback fired when the escape key is pressed.
 */
const createEscapeKeyDown = (props: {
  enabled?: MaybeAccessor<boolean>
  onEscapeKeyDown: (event: KeyboardEvent) => void
}) => {
  const defaultedProps = merge(
    {
      enabled: true,
    },
    props,
  )

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      defaultedProps.onEscapeKeyDown(event)
    }
  }

  createEffect(
    () => access(defaultedProps.enabled),
    (enabled) => {
      if (!enabled) return

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    },
  )
}

export default createEscapeKeyDown
