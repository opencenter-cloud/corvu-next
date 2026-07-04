import createPersistent from '@corvu-next/persistent'
import { createSignal, Show } from 'solid-js'

function ExpensiveCounter() {
  const [count, setCount] = createSignal(0)
  console.log('ExpensiveCounter rendered (should only log once)')
  return (
    <div style="padding: 1rem; border: 2px solid #007acc; border-radius: 8px;">
      <p>Persistent counter: {count()}</p>
      <button
        onClick={() => setCount((c) => c + 1)}
        style="padding: 0.4rem 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #ccc;"
      >
        Increment
      </button>
    </div>
  )
}

export default function PersistentDemo() {
  const [show, setShow] = createSignal(true)
  const persistedCounter = createPersistent(() => <ExpensiveCounter />)

  return (
    <div>
      <h2>Persistent</h2>
      <p>Toggle visibility — counter state persists and component doesn't re-render.</p>
      <button
        onClick={() => setShow((s) => !s)}
        style="padding: 0.4rem 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; margin-bottom: 1rem;"
      >
        {show() ? 'Hide' : 'Show'}
      </button>
      <Show when={show()}>
        {persistedCounter()}
      </Show>
    </div>
  )
}
