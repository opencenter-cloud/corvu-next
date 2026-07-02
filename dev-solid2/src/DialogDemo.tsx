import { createSignal, Show } from 'solid-js'
import { Portal } from '@solidjs/web'
import createPresence from '@corvu-next/presence'
import createPreventScroll from '@corvu-next/prevent-scroll'
import createFocusTrap from '@corvu-next/focus-trap'
import Dismissible from '@corvu-next/dismissible'

export default function DialogDemo() {
  const [open, setOpen] = createSignal(false)
  const [contentRef, setContentRef] = createSignal<HTMLDivElement | null>(null)

  const { present, state } = createPresence({
    show: open,
    element: contentRef,
  })

  createPreventScroll({
    element: contentRef,
    enabled: open,
    hideScrollbar: true,
  })

  createFocusTrap({
    element: contentRef,
    enabled: open,
  })

  return (
    <div>
      <p>
        Scroll this page to test scrollbar behavior. Click the button to open
        a dialog. The dialog should:
      </p>
      <ul>
        <li>Fade in with animation</li>
        <li>Trap focus (Tab loops inside)</li>
        <li>Lock body scroll</li>
        <li>Dismiss on Escape, outside click, or Close button</li>
        <li>Fade out with animation on close</li>
      </ul>
      <div style="height: 200vh; padding-top: 1rem;">
        <button onClick={() => setOpen(true)}>Open Dialog</button>
        <p style="margin-top: 50vh;">Middle of the page</p>
      </div>

      <Show when={present()}>
        <Portal>
          <Dismissible
            enabled={open()}
            element={contentRef}
            onDismiss={() => setOpen(false)}
          >
            <div class="dialog-overlay">
              <div
                ref={setContentRef}
                class="dialog-content"
                data-state={state()}
                role="dialog"
                aria-modal="true"
              >
                <h2>Dialog Title</h2>
                <p>Focus should be trapped here.</p>
                <input placeholder="Try tabbing through these" />
                <br /><br />
                <button>Some action</button>
                {' '}
                <button onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
          </Dismissible>
        </Portal>
      </Show>
    </div>
  )
}
