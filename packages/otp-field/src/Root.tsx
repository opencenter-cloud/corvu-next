import {
  createEffect,
  createSignal,
  merge,
  omit,
  untrack,
} from 'solid-js'
import type { JSX, ValidComponent } from '@solidjs/web'
import {
  createInternalOtpFieldContext,
  createOtpFieldContext,
} from '@src/context'
import { Dynamic, type DynamicProps } from '@corvu-next/utils/dynamic'
import { combineStyle } from '@corvu-next/utils/dom'
import createControllableSignal from '@corvu-next/utils/create/controllableSignal'
import createOnce from '@corvu-next/utils/create/once'
import createSize from '@corvu-next/utils/create/size'
import type { ElementOf } from '@corvu-next/utils/dom'
import { isFunction } from '@corvu-next/utils'
import { mergeRefs } from '@corvu-next/utils/reactivity'
import type { Ref } from '@corvu-next/utils/dom'

export type OtpFieldRootCorvuProps = {
  /** Max number of chars. Is required. */
  maxLength: number
  /** The value of the OTP Field. */
  value?: string
  /** Callback fired when the OTP Field value changes. */
  onValueChange?: (value: string) => void
  /** Callback fired when the OTP Field is filled. */
  onComplete?: (value: string) => void
  /**
   * Whether to create extra space on the right for password managers.
   * @defaultValue `true`
   */
  shiftPWManagers?: boolean
  /**
   * The `id` of the OTP Field context. Useful if you have nested OTP Fields and want to create components that belong to an OTP Field higher up in the tree.
   */
  contextId?: string
}

export type OtpFieldRootSharedElementProps<T extends ValidComponent = 'div'> = {
  ref: Ref<ElementOf<T>>
  style: string | JSX.CSSProperties
  children: JSX.Element | ((props: OtpFieldRootChildrenProps) => JSX.Element)
}

export type OtpFieldRootElementProps = OtpFieldRootSharedElementProps & {
  'data-corvu-otp-field-root': '' | null
}

export type OtpFieldRootProps<T extends ValidComponent = 'div'> =
  OtpFieldRootCorvuProps & Partial<OtpFieldRootSharedElementProps<T>>

/** Props that are passed to the Root component children callback. */
export type OtpFieldRootChildrenProps = {
  /** The value of the OTP Field. */
  value: string
  /** Whether the OTP Field is currently focused. */
  isFocused: boolean
  /** Whether the OTP Field is currently hovered. */
  isHovered: boolean
  /** Whether the user is currently inserting a value and a fake caret should be shown. */
  isInserting: boolean
  /** The maximum number of chars in the OTP Field. */
  maxLength: number
  /** The currently active slots in the OTP Field. */
  activeSlots: number[]
  /** Whether to create extra space on the right for password managers. */
  shiftPWManagers: boolean
}

/** OTP Field root component. Is the wrapper to position the hidden OTP Field input element and provides the context.
 *
 * @data `data-corvu-otp-field-root` - Present on every OTP Field root element.
 */
const OtpFieldRoot = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, OtpFieldRootProps<T>>,
) => {
  const defaultedProps = merge(
    {
      shiftPWManagers: true,
    },
    props as OtpFieldRootProps,
  )
  const localProps = omit(defaultedProps,
    'maxLength',
    'value',
    'onValueChange',
    'onComplete',
    'shiftPWManagers',
    'contextId',
    'ref',
    'style',
    'children',
  )

  const [ref, setRef] = createSignal<HTMLDivElement | null>(null)

  const [value, setValue] = createControllableSignal({
    value: () => defaultedProps.value,
    initialValue: '',
    onChange: defaultedProps.onValueChange,
  })

  const rootHeight = createSize({
    element: ref,
    dimension: 'height',
  })

  createEffect((prev: undefined | string) => {
    const value_ = value()
    if (value_.length !== defaultedProps.maxLength) return value_
    defaultedProps.onComplete?.(value_)
    return value_
  })

  const [isFocused, setIsFocused] = createSignal(false)
  const [isHovered, setIsHovered] = createSignal(false)
  const [isInserting, setIsInserting] = createSignal(false)
  const [activeSlots, setActiveSlots] = createSignal<number[]>([])

  const childrenProps: OtpFieldRootChildrenProps = {
    get value() {
      return value()
    },
    get isFocused() {
      return isFocused()
    },
    get isHovered() {
      return isHovered()
    },
    get isInserting() {
      return isInserting()
    },
    get maxLength() {
      return defaultedProps.maxLength
    },
    get activeSlots() {
      return activeSlots()
    },
    get shiftPWManagers() {
      return defaultedProps.shiftPWManagers
    },
  }

  const memoizedChildren = createOnce(() => defaultedProps.children)

  const resolveChildren = () => {
    const children = memoizedChildren()()
    if (isFunction(children)) {
      return children(childrenProps)
    }
    return children
  }

  const OtpFieldContext = createOtpFieldContext(defaultedProps.contextId)
  const InternalOtpFieldContext = createInternalOtpFieldContext(
    defaultedProps.contextId,
  )
  return (
    <OtpFieldContext
      value={{
        value,
        isFocused,
        isHovered,
        isInserting,
        maxLength: () => defaultedProps.maxLength,
        activeSlots,
        shiftPWManagers: () => defaultedProps.shiftPWManagers,
      }}
    >
      <InternalOtpFieldContext
        value={{
          value,
          isFocused,
          isHovered,
          isInserting,
          maxLength: () => defaultedProps.maxLength,
          activeSlots,
          shiftPWManagers: () => defaultedProps.shiftPWManagers,
          rootHeight,
          setValue,
          setIsFocused,
          setIsHovered,
          setIsInserting,
          setActiveSlots,
        }}
      >
        <Dynamic<OtpFieldRootElementProps>
          as="div"
          ref={mergeRefs(setRef, defaultedProps.ref)}
          style={combineStyle(
            {
              position: 'relative',
              'user-select': 'none',
              '-webkit-user-select': 'none',
              'pointer-events': 'none',
            },
            defaultedProps.style,
          )}
          data-corvu-otp-field-root=""
          {...localProps}
        >
          {untrack(() => resolveChildren())}
        </Dynamic>
      </InternalOtpFieldContext>
    </OtpFieldContext>
  ) as unknown as JSX.Element
}

export default OtpFieldRoot
