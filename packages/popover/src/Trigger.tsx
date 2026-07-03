import { type Component, createMemo, omit } from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import type {
  TriggerCorvuProps as DialogTriggerCorvuProps,
  TriggerElementProps as DialogTriggerElementProps,
  TriggerSharedElementProps as DialogTriggerSharedElementProps,
} from '@corvu-next/dialog'
import Dialog from '@corvu-next/dialog'
import type { DynamicProps } from '@corvu-next/utils/dynamic'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import type { Placement } from '@floating-ui/dom'
import { useInternalPopoverContext } from '@src/context'

export type PopoverTriggerCorvuProps = DialogTriggerCorvuProps

export type PopoverTriggerSharedElementProps<
  T extends ValidComponent = 'button',
> = DialogTriggerSharedElementProps<T>

export type PopoverTriggerElementProps = PopoverTriggerSharedElementProps & {
  'data-placement': Placement | undefined
  'data-corvu-popover-trigger': ''
} & DialogTriggerElementProps

export type PopoverTriggerProps<T extends ValidComponent = 'button'> =
  PopoverTriggerCorvuProps & Partial<PopoverTriggerSharedElementProps<T>>

/** Button that changes the open state of the popover when clicked.
 *
 * @data `data-corvu-popover-trigger` - Present on every popover trigger element.
 * @data `data-open` - Present when the popover is open.
 * @data `data-closed` - Present when the popover is closed.
 * @data `data-placement` - Current placement of the popover. Only present when the popover is open.
 */
const PopoverTrigger = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, PopoverTriggerProps<T>>,
) => {
  const otherProps = omit(props as PopoverTriggerProps,
    'ref',
    'contextId',
  )

  const dialogContext = createMemo(() =>
    Dialog.useContext((props as PopoverTriggerProps).contextId),
  )

  const context = createMemo(() =>
    useInternalPopoverContext((props as PopoverTriggerProps).contextId),
  )

  return (
    <Dialog.Trigger<
      Component<
        Omit<PopoverTriggerElementProps, keyof DialogTriggerElementProps>
      >
    >
      contextId={(props as PopoverTriggerProps).contextId}
      // === SharedElementProps ===
      ref={mergeRefs(context().setTriggerRef, (props as PopoverTriggerProps).ref)}
      // === ElementProps ===
      data-placement={
        dialogContext().open() ? context().floatingState().placement : undefined
      }
      data-corvu-popover-trigger=""
      // === Misc ===
      data-corvu-dialog-trigger={null}
      {...otherProps}
    />
  )
}

export default PopoverTrigger
