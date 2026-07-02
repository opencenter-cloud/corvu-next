import { createSignal, Show } from 'solid-js'
import DialogDemo from './DialogDemo'
import ListDemo from './ListDemo'

export default function App() {
  const [tab, setTab] = createSignal<'dialog' | 'list'>('dialog')

  return (
    <div>
      <h1>@corvu-next dev app (Solid 2.0-beta.15)</h1>
      <nav style="margin-bottom: 1rem;">
        <button onClick={() => setTab('dialog')}>
          Dialog (presence + prevent-scroll + focus-trap + dismissible)
        </button>
        {' '}
        <button onClick={() => setTab('list')}>
          List (createList)
        </button>
      </nav>
      <Show when={tab() === 'dialog'}>
        <DialogDemo />
      </Show>
      <Show when={tab() === 'list'}>
        <ListDemo />
      </Show>
    </div>
  )
}
