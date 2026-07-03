import OtpField from '@corvu-next/otp-field'
import { createSignal } from 'solid-js'

export default function OtpFieldDemo() {
  const [value, setValue] = createSignal('')

  return (
    <div>
      <h2>OTP Field</h2>
      <p>Type a 6-digit code. Auto-advances to next slot.</p>
      <OtpField maxLength={6} onValueChange={setValue}>
        <div style="display: flex; gap: 0.5rem;">
          <OtpField.Input
            style="width: 2.5rem; height: 3rem; text-align: center; font-size: 1.25rem; border: 2px solid #ccc; border-radius: 8px;"
          />
        </div>
      </OtpField>
      <p>Value: <code>{value()}</code></p>
    </div>
  )
}
