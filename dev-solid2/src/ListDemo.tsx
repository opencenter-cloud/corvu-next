import { For } from '@solidjs/web'
import { createList } from '@corvu-next/list'

const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']

export default function ListDemo() {
  const { active, onKeyDown } = createList<string>({
    items,
    initialActive: items[0]!,
    orientation: 'vertical',
    loop: true,
  })

  return (
    <div>
      <p>Use arrow keys to navigate. Home/End jump to first/last. Loops.</p>
      <div
        tabindex="0"
        onKeyDown={onKeyDown}
        style="outline: 2px dashed #ccc; padding: 1rem; display: inline-block;"
      >
        <For each={items}>
          {(item) => (
            <div class="list-item" aria-selected={active() === item}>
              {item}
            </div>
          )}
        </For>
      </div>
      <p>Active: <strong>{active() ?? '(none)'}</strong></p>
    </div>
  )
}
