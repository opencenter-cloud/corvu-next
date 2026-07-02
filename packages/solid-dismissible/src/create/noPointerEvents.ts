import { access, type MaybeAccessor } from '@corvu-next/utils/reactivity'
import { createEffect, merge } from 'solid-js'
import createStyle from '@corvu-next/utils/create/style'

/**
 * Disables pointer events on the `<body>` element.
 *
 * @param props.enabled - Whether pointer events should be disabled. *Default = `true`*
 */
const createNoPointerEvents = (props: { enabled?: MaybeAccessor<boolean> }) => {
  const defaultedProps = merge(
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

      createStyle({
        key: 'no-pointer-events',
        element: body,
        style: {
          pointerEvents: 'none',
        },
      })
    },
  )
}

export default createNoPointerEvents
