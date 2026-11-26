import {
  access,
  type MaybeAccessor,
  mergeDefaults,
} from '@corvu-next/utils/reactivity'
import { createEffect } from 'solid-js'
import createStyle from '@corvu-next/utils/create/style'

/**
 * Disables pointer events on the `<body>` element.
 */
const createNoPointerEvents = (props: { enabled?: MaybeAccessor<boolean> }) => {
  const defaultedProps = mergeDefaults(
    {
      enabled: true,
    },
    props,
  )

  createEffect(
    () => access(defaultedProps.enabled),
    (enabled) => {
      if (!enabled) return

      const { body } = document

      const revertStyle = createStyle({
        key: 'no-pointer-events',
        element: body,
        style: {
          pointerEvents: 'none',
        },
      })

      return revertStyle
    },
  )
}

export default createNoPointerEvents
