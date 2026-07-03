import Tooltip from '@corvu-next/tooltip'

export default function TooltipDemo() {
  return (
    <div>
      <h2>Tooltip</h2>
      <p>Hover over the button to see the tooltip.</p>
      <Tooltip>
        <Tooltip.Trigger
          as="button"
          style="padding: 0.5rem 1rem; cursor: pointer;"
        >
          Hover me
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            style="background: #333; color: white; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.875rem;"
          >
            This is a tooltip!
            <Tooltip.Arrow style="color: #333;" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip>
    </div>
  )
}
