import { createMemo, omit } from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import type { DynamicAttributes, DynamicProps } from '@src/dynamic/types'
import type { ElementOf, Ref } from '@src/dom'
import Dynamic from '@src/dynamic/Dynamic'
import { isButton } from '@src/assertions'
import { mergeRefs } from '@src/reactivity'

export type DynamicButtonSharedElementProps<
  T extends ValidComponent = 'button',
> = {
  ref: Ref<ElementOf<T>>
  type: string | undefined
}

export type DynamicButtonElementProps = DynamicButtonSharedElementProps & {
  role: 'button' | undefined
}

export type DynamicButtonProps<T extends ValidComponent = 'button'> = Partial<
  DynamicButtonSharedElementProps<T>
>

/** An accessible button that sets `type` and `role` properly based on if it's a native button. */
const DynamicButton = <T extends ValidComponent = 'button'>(
  props: DynamicProps<T, DynamicButtonProps<T>>,
) => {
  const buttonProps = props as DynamicButtonProps<'button'> &
    DynamicAttributes<ValidComponent>
  const otherProps = omit(buttonProps, 'as', 'type')

  /** What `Dynamic` renders, with this component's `button` default standing
   *  in for the `div` one `Dynamic` applies on its own. */
  const as = createMemo<ValidComponent>(() => buttonProps.as ?? 'button')

  /** The tag of the rendered element, read off the prop that decides it: a
   *  string `as` is the tag, and a component `as` renders what it likes with
   *  `type` and `role` handed to it as props, so the `button` default stands.
   *
   *  Measuring the mounted element instead would put `type` and `role` on the
   *  far side of the ref: Solid's spread applies the ref and the attributes in
   *  one effect, so a tag name read back through that ref makes the effect
   *  re-run on its own write (`EFFECT_WRITES_OWN_SOURCE`) — two flushes, with
   *  the element in the document carrying a native `type` it is about to drop
   *  in between, and the same wrong markup served by SSR, where no effect ever
   *  corrects it. */
  const tagName = createMemo(() => {
    const component = as()
    return typeof component === 'string' ? component : 'button'
  })

  const memoizedIsButton = createMemo(() => {
    return isButton(tagName(), buttonProps.type)
  })

  return (
    <Dynamic<DynamicButtonElementProps>
      as={as()}
      // === SharedElementProps ===
      // No ref of its own to merge in any more; this normalizes the
      // consumer's optional one into the callback the element props take.
      ref={mergeRefs(buttonProps.ref)}
      type={memoizedIsButton() ? 'button' : undefined}
      // === ElementProps ===
      role={!memoizedIsButton() ? 'button' : undefined}
      {...otherProps}
    />
  )
}

export default DynamicButton
