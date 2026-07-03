import Accordion from '@corvu-next/accordion'

export default function AccordionDemo() {
  return (
    <div>
      <h2>Accordion</h2>
      <p>Click headers to expand/collapse. Multiple items can be open.</p>
      <Accordion multiple>
        {({ items }) => (
          <div style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden;">
            <Accordion.Item value="item-1">
              <Accordion.Trigger style="display: block; width: 100%; padding: 0.75rem 1rem; background: #f5f5f5; border: none; border-bottom: 1px solid #ccc; cursor: pointer; text-align: left; font-weight: bold;">
                Section 1: Getting Started
              </Accordion.Trigger>
              <Accordion.Content style="padding: 1rem;">
                <p>This is the content for section 1. It collapses and expands with animation.</p>
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-2">
              <Accordion.Trigger style="display: block; width: 100%; padding: 0.75rem 1rem; background: #f5f5f5; border: none; border-bottom: 1px solid #ccc; cursor: pointer; text-align: left; font-weight: bold;">
                Section 2: Configuration
              </Accordion.Trigger>
              <Accordion.Content style="padding: 1rem;">
                <p>This is the content for section 2. Try opening multiple sections.</p>
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-3">
              <Accordion.Trigger style="display: block; width: 100%; padding: 0.75rem 1rem; background: #f5f5f5; border: none; cursor: pointer; text-align: left; font-weight: bold;">
                Section 3: Advanced
              </Accordion.Trigger>
              <Accordion.Content style="padding: 1rem;">
                <p>This is the content for section 3.</p>
              </Accordion.Content>
            </Accordion.Item>
          </div>
        )}
      </Accordion>
    </div>
  )
}
