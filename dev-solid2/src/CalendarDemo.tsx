import Calendar from '@corvu-next/calendar'
import { createSignal, For } from 'solid-js'

export default function CalendarDemo() {
  const [selected, setSelected] = createSignal<Date | null>(null)

  return (
    <div>
      <h2>Calendar</h2>
      <p>Selected: {selected()?.toLocaleDateString() ?? 'none'}</p>
      <Calendar mode="single" onValueChange={setSelected}>
        {(props) => (
          <div style="width: 280px; border: 1px solid #ccc; border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <Calendar.Nav action="prev-month" style="cursor: pointer; padding: 0.25rem 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
                ←
              </Calendar.Nav>
              <Calendar.Label>
                {props.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Calendar.Label>
              <Calendar.Nav action="next-month" style="cursor: pointer; padding: 0.25rem 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
                →
              </Calendar.Nav>
            </div>
            <Calendar.Table>
              <thead>
                <tr>
                  <For each={props.weekdays}>
                    {(weekday) => (
                      <Calendar.HeadCell style="padding: 0.25rem; font-size: 0.75rem; color: #666;">
                        {weekday.toLocaleDateString(undefined, { weekday: 'short' })}
                      </Calendar.HeadCell>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={props.weeks}>
                  {(week) => (
                    <tr>
                      <For each={week}>
                        {(day) => (
                          <Calendar.Cell>
                            <Calendar.CellTrigger
                              day={day}
                              style="padding: 0.4rem; cursor: pointer; border-radius: 4px; border: none; background: transparent; width: 100%; text-align: center;"
                            >
                              {day.getDate()}
                            </Calendar.CellTrigger>
                          </Calendar.Cell>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </Calendar.Table>
          </div>
        )}
      </Calendar>
    </div>
  )
}
