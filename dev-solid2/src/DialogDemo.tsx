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
    enabled: () => open(),
    hideScrollbar: true,
  })

  createFocusTrap({
    element: contentRef,
    enabled: () => open(),
  })

  return (
    <div>
      <h2>Dialog (Primitives)</h2>
      <p>Tests: presence animation, scroll lock, focus trap, dismissible layers.</p>
      <div style="height: 150vh; padding-top: 1rem;">
        <button onClick={() => setOpen(true)}>Open Dialog</button>
        <p style="margin-top: 30vh;">Scroll position marker</p>
      </div>

      <Show when={present()}>
        <Portal>
          <Dismissible
            enabled={open()}
            element={contentRef}
            onDismiss={() => setOpen(false)}
            dismissOnOutsidePointer={false}
            noOutsidePointerEvents={false}
          >
            <div class="dialog-overlay" onPointerUp={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}>
              <div
                ref={setContentRef}
                class="dialog-content"
                data-state={state()}
                role="dialog"
                aria-modal="true"
              >
                <h3>Dialog Title</h3>
                <p>Focus is trapped. Body scroll is locked.</p>
                <input placeholder="Tab cycles through inputs" />
                <br /><br />
                <button onClick={() => alert('Action clicked!')}>Action</button>{' '}
                <button onClick={() => setOpen(false)}>Close</button>
                <p style="font-size: 0.8rem; color: #666; margin-top: 1rem;">
                  Dismiss: Escape key, click overlay, or Close button.
                </p>
              </div>
            </div>
          </Dismissible>
        </Portal>
      </Show>
    </div>
  )
}
