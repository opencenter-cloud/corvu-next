import createTransitionSize from '@corvu-next/transition-size'
import { createSignal } from 'solid-js'

export default function TransitionSizeDemo() {
  const [expanded, setExpanded] = createSignal(false)
  const [ref, setRef] = createSignal<HTMLElement | null>(null)

  const { transitioning, transitionSize } = createTransitionSize({
    element: ref,
    dimension: 'height',
  })

  return (
    <div>
      <h2>Transition Size</h2>
      <p>
        Transitioning: {transitioning() ? 'yes' : 'no'} |
        Size: {transitionSize() ?? 'null'}
      </p>
      <button
        onClick={() => setExpanded((e) => !e)}
        style="padding: 0.4rem 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; margin-bottom: 1rem;"
      >
        {expanded() ? 'Collapse' : 'Expand'}
      </button>
      <div
        ref={setRef}
        style={{
          overflow: 'hidden',
          'border-radius': '8px',
          border: '1px solid #ccc',
          transition: 'height 300ms ease',
          height: transitionSize() !== null ? `${transitionSize()}px` : undefined,
        }}
      >
        <div style="padding: 1rem;">
          <p>First line of content.</p>
          {expanded() && (
            <>
              <p>More content revealed on expand.</p>
              <p>Even more content to demonstrate height transition.</p>
              <p>Last line.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
