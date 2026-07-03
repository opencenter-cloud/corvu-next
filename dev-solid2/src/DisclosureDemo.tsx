import Disclosure from '@corvu-next/disclosure'

export default function DisclosureDemo() {
  return (
    <div>
      <h2>Disclosure</h2>
      <p>Click to expand/collapse content.</p>
      <Disclosure>
        {({ expanded }) => (
          <div style="border: 1px solid #ccc; border-radius: 8px; overflow: hidden;">
            <Disclosure.Trigger style="display: block; width: 100%; padding: 0.75rem 1rem; background: #f0f0f0; border: none; cursor: pointer; text-align: left; font-weight: bold;">
              {expanded ? '▼' : '▶'} Click to toggle details
            </Disclosure.Trigger>
            <Disclosure.Content style="padding: 1rem;">
              <p>This content is revealed when the disclosure is expanded.</p>
              <p>It supports enter/exit animations via CSS.</p>
            </Disclosure.Content>
          </div>
        )}
      </Disclosure>
    </div>
  )
}
