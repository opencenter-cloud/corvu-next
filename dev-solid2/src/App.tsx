import { createSignal, Show } from 'solid-js'
import DialogDemo from './DialogDemo'
import ListDemo from './ListDemo'
import PopoverDemo from './PopoverDemo'
import TooltipDemo from './TooltipDemo'
import DisclosureDemo from './DisclosureDemo'
import AccordionDemo from './AccordionDemo'
import ResizableDemo from './ResizableDemo'
import OtpFieldDemo from './OtpFieldDemo'
import CalendarDemo from './CalendarDemo'
import DrawerDemo from './DrawerDemo'
import PersistentDemo from './PersistentDemo'
import TransitionSizeDemo from './TransitionSizeDemo'

type Tab = 'dialog' | 'list' | 'popover' | 'tooltip' | 'disclosure' | 'accordion' | 'resizable' | 'otp-field' | 'calendar' | 'drawer' | 'persistent' | 'transition-size'

const tabs: { id: Tab; label: string }[] = [
  { id: 'dialog', label: 'Dialog' },
  { id: 'drawer', label: 'Drawer' },
  { id: 'popover', label: 'Popover' },
  { id: 'tooltip', label: 'Tooltip' },
  { id: 'disclosure', label: 'Disclosure' },
  { id: 'accordion', label: 'Accordion' },
  { id: 'resizable', label: 'Resizable' },
  { id: 'otp-field', label: 'OTP Field' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'persistent', label: 'Persistent' },
  { id: 'transition-size', label: 'Transition Size' },
  { id: 'list', label: 'List' },
]

export default function App() {
  const [tab, setTab] = createSignal<Tab>('dialog')

  return (
    <div>
      <h1>@corvu-next dev app (Solid 2.0-beta.15)</h1>
      <nav style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
        {tabs.map((t) => (
          <button
            onClick={() => setTab(t.id)}
            style={`padding: 0.4rem 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; ${
              tab() === t.id ? 'background: #007acc; color: white; border-color: #007acc;' : 'background: white;'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <Show when={tab() === 'dialog'}><DialogDemo /></Show>
      <Show when={tab() === 'drawer'}><DrawerDemo /></Show>
      <Show when={tab() === 'popover'}><PopoverDemo /></Show>
      <Show when={tab() === 'tooltip'}><TooltipDemo /></Show>
      <Show when={tab() === 'disclosure'}><DisclosureDemo /></Show>
      <Show when={tab() === 'accordion'}><AccordionDemo /></Show>
      <Show when={tab() === 'resizable'}><ResizableDemo /></Show>
      <Show when={tab() === 'otp-field'}><OtpFieldDemo /></Show>
      <Show when={tab() === 'calendar'}><CalendarDemo /></Show>
      <Show when={tab() === 'persistent'}><PersistentDemo /></Show>
      <Show when={tab() === 'transition-size'}><TransitionSizeDemo /></Show>
      <Show when={tab() === 'list'}><ListDemo /></Show>
    </div>
  )
}
