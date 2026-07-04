import {
  onCleanup,
  omit,
  untrack,
} from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { useInternalCalendarContext } from '@src/context'

export type CalendarLabelCorvuProps = {
  /**
   * The index of the calendar table that this label is describing. Is optional as it's not required if only one month is rendered.
   */
  index?: number
  /**
   * The `id` of the calendar context to use.
   */
  contextId?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type CalendarLabelSharedElementProps<T extends ValidComponent = 'h2'> =
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  {}

export type CalendarLabelElementProps = CalendarLabelSharedElementProps & {
  id: string | undefined
  'aria-live': 'polite'
  'data-corvu-calendar-label': '' | null
}

export type CalendarLabelProps<T extends ValidComponent = 'h2'> =
  CalendarLabelCorvuProps & Partial<CalendarLabelSharedElementProps<T>>

/** Label element to announce the calendar to accessibility tools.
 *
 * @data `data-corvu-calendar-label` - Present on every calendar label element.
 */
const CalendarLabel = <T extends ValidComponent = 'h2'>(
  props: DynamicProps<T, CalendarLabelProps<T>>,
) => {
  const p = props as CalendarLabelProps
  const otherProps = omit(p, 'index', 'contextId')

  const context = useInternalCalendarContext(p.contextId)

  untrack(() => context.registerLabelId(p.index ?? 0))
  onCleanup(() => context.unregisterLabelId(p.index ?? 0))

  return (
    <Dynamic<CalendarLabelElementProps>
      as="h2"
      // === ElementProps ===
      id={context.labelIds()[p.index ?? 0]?.()}
      aria-live="polite"
      data-corvu-calendar-label=""
      {...otherProps}
    />
  )
}

export default CalendarLabel
