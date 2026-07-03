import {
  createEffect,
  createSignal,
  omit,
  untrack,
} from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import { callEventHandler, type ElementOf, type Ref } from '@corvu-next/utils/dom'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import {
  isSameDay,
  isSameDayOrAfter,
  isSameDayOrBefore,
  modifyFocusedDay,
} from '@src/utils'
import { dataIf } from '@corvu-next/utils'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import { useInternalCalendarContext } from '@src/context'

export type CalendarCellTriggerCorvuProps = {
  /*
   * The day that this cell trigger represents. Used to handle selection and focus.
   */
  day: Date
  /**
   * The month that this cell trigger belongs to. Is optional as it's not required if only one month is rendered.
   */
  month?: Date
  /**
   * The `id` of the calendar context to use.
   */
  contextId?: string
}

export type CalendarCellTriggerSharedElementProps<
  T extends ValidComponent = 'button',
> = {
  ref: Ref<ElementOf<T>>
  onClick: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>
  onKeyDown: JSX.EventHandlerUnion<ElementOf<T>, KeyboardEvent>
  disabled: boolean | undefined
}

export type CalendarCellTriggerElementProps =
  CalendarCellTriggerSharedElementProps & {
    role: 'gridcell'
    tabIndex: number
    'aria-selected': 'true' | 'false' | undefined
    'aria-disabled': 'true' | undefined
    'data-selected': '' | undefined
    'data-disabled': '' | undefined
    'data-today': '' | undefined
    'data-range-start': '' | undefined
    'data-range-end': '' | undefined
    'data-in-range': '' | undefined
    'data-corvu-calendar-celltrigger': '' | null
  }

export type CalendarCellTriggerProps<T extends ValidComponent = 'button'> =
  CalendarCellTriggerCorvuProps &
    Partial<CalendarCellTriggerSharedElementProps<T>>

/** Button that selectes a day in the calendar.
 *
 * @data `data-selected` - Present on selected calendar cell triggers.
 * @data `data-disabled` - Present on disabled calendar cell triggers.
 * @data `data-today` - Present on today's calendar cell trigger. Only rendered on the client to avoid hydration mismatches
 * @data `data-range-start` - Present on the start of a day range. (Only present in range mode)
 * @data `data-range-end` - Present on the end of a day range. (Only present in range mode)
 * @data `data-in-range` - Present on calendar cell trigger elements that are within a day range. (Including start and end, only present in range mode)
 * @data `data-corvu-calendar-celltrigger` - Present on every calendar celltrigger element.
 */
const CalendarCellTrigger = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, CalendarCellTriggerProps<T>>,
) => {
  const p = props as CalendarCellTriggerProps
  const otherProps = omit(p, 'day', 'month', 'contextId', 'ref', 'onClick', 'onKeyDown', 'disabled')

  const [ref, setRef] = createSignal<HTMLButtonElement | null>(null)

  const [isToday, setIsToday] = createSignal(false)
  createEffect(() => {
    setIsToday(isSameDay(p.day, new Date()))
  })

  const context = useInternalCalendarContext(p.contextId)

  createEffect(() => {
    const focusedDay = context.focusedDay()
    const day = p.day
    const month = p.month
    if (!untrack(() => context.isFocusing())) return
    if (context.isDisabled(day, month)) return
    if (isSameDay(focusedDay, day)) {
      untrack(() => {
        ref()?.focus()
        context.setIsFocusing(false)
      })
    }
  })

  createEffect(() => {
    if (context.isDisabled(p.day, p.month)) return
    if (isSameDay(p.day, context.focusedDay())) {
      context.setFocusedDayRef(ref())
      return () => {
        context.setFocusedDayRef(null)
      }
    }
  })

  const onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (e) => {
    !callEventHandler(p.onClick, e) &&
      context.onDaySelect(p.day)
  }

  const onKeyDown: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (
    event,
  ) => {
    if (callEventHandler(p.onKeyDown, event)) return

    let focusedDay: Date | null = null
    if (
      (event.key === 'ArrowLeft' && context.textDirection() === 'ltr') ||
      (event.key === 'ArrowRight' && context.textDirection() === 'rtl')
    ) {
      event.preventDefault()
      focusedDay = modifyFocusedDay(
        p.day,
        { day: -1 },
        context.disabled,
      )
    } else if (
      (event.key === 'ArrowRight' && context.textDirection() === 'ltr') ||
      (event.key === 'ArrowLeft' && context.textDirection() === 'rtl')
    ) {
      event.preventDefault()
      focusedDay = modifyFocusedDay(
        p.day,
        { day: 1 },
        context.disabled,
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusedDay = modifyFocusedDay(
        p.day,
        { day: -7 },
        context.disabled,
      )
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusedDay = modifyFocusedDay(
        p.day,
        { day: 7 },
        context.disabled,
      )
    } else if (
      (event.key === 'Home' && context.textDirection() === 'ltr') ||
      (event.key === 'End' && context.textDirection() === 'rtl')
    ) {
      event.preventDefault()
      focusedDay = modifyFocusedDay(
        p.day,
        {
          day: -((p.day.getDay() - context.startOfWeek() + 7) % 7),
        },
        context.disabled,
        false,
      )
    } else if (
      (event.key === 'End' && context.textDirection() === 'ltr') ||
      (event.key === 'Home' && context.textDirection() === 'rtl')
    ) {
      event.preventDefault()
      focusedDay = modifyFocusedDay(
        p.day,
        {
          day: (context.startOfWeek() + 6 - p.day.getDay() + 7) % 7,
        },
        context.disabled,
        false,
      )
    } else if (event.key === 'PageUp') {
      event.preventDefault()
      if (event.shiftKey) {
        focusedDay = modifyFocusedDay(
          p.day,
          { year: -1 },
          context.disabled,
        )
      } else {
        focusedDay = modifyFocusedDay(
          p.day,
          { month: -1 },
          context.disabled,
        )
      }
    } else if (event.key === 'PageDown') {
      event.preventDefault()
      if (event.shiftKey) {
        focusedDay = modifyFocusedDay(
          p.day,
          { year: 1 },
          context.disabled,
        )
      } else {
        focusedDay = modifyFocusedDay(
          p.day,
          { month: 1 },
          context.disabled,
        )
      }
    }

    if (focusedDay === null) return
    context.setIsFocusing(true)
    context.setFocusedDay(focusedDay)
  }

  return (
    <Dynamic<CalendarCellTriggerElementProps>
      as="button"
      // === SharedElementProps ===
      ref={mergeRefs(setRef, p.ref)}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={
        p.disabled === true ||
        context.isDisabled(p.day, p.month) ||
        undefined
      }
      // === ElementProps ===
      role="gridcell"
      tabIndex={isSameDay(context.focusedDay(), p.day) ? 0 : -1}
      aria-selected={
        context.isSelected(p.day)
          ? 'true'
          : !context.isDisabled(p.day, p.month)
            ? 'false'
            : undefined
      }
      aria-disabled={
        context.isDisabled(p.day, p.month)
          ? 'true'
          : undefined
      }
      data-selected={dataIf(context.isSelected(p.day))}
      data-disabled={dataIf(
        context.isDisabled(p.day, p.month),
      )}
      data-today={dataIf(isToday())}
      data-range-start={dataIf(
        context.mode() === 'range' &&
          isSameDay(
            p.day,
            (context.value() as { from: Date | null; to: Date | null }).from,
          ),
      )}
      data-range-end={dataIf(
        context.mode() === 'range' &&
          isSameDay(
            p.day,
            (context.value() as { from: Date | null; to: Date | null }).to,
          ),
      )}
      data-in-range={dataIf(
        context.mode() === 'range' &&
          isSameDayOrAfter(
            p.day,
            (context.value() as { from: Date | null; to: Date | null }).from,
          ) &&
          isSameDayOrBefore(
            p.day,
            (context.value() as { from: Date | null; to: Date | null }).to,
          ),
      )}
      data-corvu-calendar-celltrigger=""
      {...otherProps}
    />
  )
}

export default CalendarCellTrigger
