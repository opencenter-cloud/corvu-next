import { callEventHandler, type ElementOf } from '@corvu-next/utils/dom'
import {
  createMemo,
  omit,
} from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import {
  DynamicButton,
  type DynamicButtonElementProps,
  type DynamicButtonSharedElementProps,
  type DynamicProps,
} from '@corvu-next/utils/dynamic'
import { useInternalCalendarContext } from '@src/context'

export type CalendarNavCorvuProps = {
  /**
   * The action to perform when pressing this navigation button.
   */
  action: `${'prev' | 'next'}-${'month' | 'year'}` | ((date: Date) => Date)
  /**
   * The `id` of the calendar context to use.
   */
  contextId?: string
}

export type CalendarNavSharedElementProps<T extends ValidComponent = 'button'> =
  {
    onClick: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
  } & DynamicButtonSharedElementProps<T>

export type CalendarNavElementProps = CalendarNavSharedElementProps &
  DynamicButtonElementProps & {
    'data-corvu-calendar-nav': '' | null
  }

export type CalendarNavProps<T extends ValidComponent = 'button'> =
  CalendarNavCorvuProps & Partial<CalendarNavSharedElementProps<T>>

/** Button to navigate the calendar.
 *
 * @data `data-corvu-calendar-nav` - Present on every calendar nav element.
 */
const CalendarNav = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, CalendarNavProps<T>>,
) => {
  const otherProps = omit(props as CalendarNavProps, 'action', 'contextId', 'onClick')

  const context = createMemo(() =>
    useInternalCalendarContext((props as CalendarNavProps).contextId),
  )

  const onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (e) => {
    !callEventHandler((props as CalendarNavProps).onClick, e) &&
      context().navigate((props as CalendarNavProps).action)
  }

  return (
    <DynamicButton
      as="button"
      // === SharedElementProps ===
      onClick={onClick}
      // === ElementProps ===
      data-corvu-calendar-nav=""
      {...(otherProps as Record<string, unknown>)}
    />
  )
}

export default CalendarNav
