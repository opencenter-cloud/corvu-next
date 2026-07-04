import OtpField from '@corvu-next/otp-field'
import { createSignal, For } from 'solid-js'

function Slot(props: { index: number }) {
  const context = OtpField.useContext()
  const char = () => context.value()[props.index] ?? ''
  const isActive = () => context.activeSlots().includes(props.index)

  return (
    <div
      style={{
        width: '2.5rem',
        height: '3rem',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'font-size': '1.25rem',
        border: `2px solid ${isActive() ? '#333' : '#ccc'}`,
        'border-radius': '8px',
        background: isActive() ? '#f0f0f0' : '#fff',
      }}
    >
      {char()}
    </div>
  )
}

export default function OtpFieldDemo() {
  const [value, setValue] = createSignal('')

  return (
    <div>
      <h2>OTP Field</h2>
      <p>Type a 6-digit code. Click the area below first.</p>
      <OtpField maxLength={6} onValueChange={setValue}>
        <div style="display: flex; gap: 0.5rem;">
          <For each={[0, 1, 2, 3, 4, 5]}>
            {(index) => <Slot index={index} />}
          </For>
        </div>
        <OtpField.Input />
      </OtpField>
      <p>Value: <code>{value()}</code></p>
    </div>
  )
}
