import Popover from '@corvu-next/popover'

export default function PopoverDemo() {
  return (
    <div>
      <h2>Popover</h2>
      <p>Click the button to open a positioned popover.</p>
      <Popover>
        <Popover.Trigger
          as="button"
          style="padding: 0.5rem 1rem; cursor: pointer;"
        >
          Open Popover
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            style="background: white; border: 1px solid #ccc; border-radius: 8px; padding: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px;"
          >
            <p style="margin: 0 0 0.5rem 0; font-weight: bold;">Popover Title</p>
            <p style="margin: 0 0 0.5rem 0;">This is positioned with floating-ui.</p>
            <Popover.Close
              as="button"
              style="padding: 0.25rem 0.5rem; cursor: pointer;"
            >
              Close
            </Popover.Close>
            <Popover.Arrow style="color: white;" />
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  )
}
