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
              <Calendar.Nav action="prev" style="cursor: pointer; padding: 0.25rem 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
                ←
              </Calendar.Nav>
              <Calendar.Label style="font-weight: bold;" />
              <Calendar.Nav action="next" style="cursor: pointer; padding: 0.25rem 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
                →
              </Calendar.Nav>
            </div>
            <Calendar.Table>
              {(tableProps) => (
                <table style="width: 100%; border-collapse: collapse; text-align: center;">
                  <thead>
                    <tr>
                      <For each={tableProps.weekdays}>
                        {(weekday) => (
                          <Calendar.HeadCell style="padding: 0.25rem; font-size: 0.75rem; color: #666;">
                            {weekday.short}
                          </Calendar.HeadCell>
                        )}
                      </For>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={tableProps.weeks}>
                      {(week) => (
                        <tr>
                          <For each={week}>
                            {(day) => (
                              <Calendar.Cell date={day.date}>
                                <Calendar.CellTrigger
                                  date={day.date}
                                  style={`padding: 0.4rem; cursor: pointer; border-radius: 4px; border: none; background: ${day.isSelected ? '#007acc' : 'transparent'}; color: ${day.isSelected ? 'white' : day.isOutsideMonth ? '#bbb' : '#333'};`}
                                >
                                  {day.date.getDate()}
                                </Calendar.CellTrigger>
                              </Calendar.Cell>
                            )}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              )}
            </Calendar.Table>
          </div>
        )}
      </Calendar>
    </div>
  )
}
