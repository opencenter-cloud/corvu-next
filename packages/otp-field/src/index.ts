import {
  type OtpFieldContextValue as ContextValue,
  useOtpFieldContext as useContext,
} from '@src/context'
import Input, {
  type OtpFieldInputCorvuProps as InputCorvuProps,
  type OtpFieldInputElementProps as InputElementProps,
  type OtpFieldInputProps as InputProps,
  type OtpFieldInputSharedElementProps as InputSharedElementProps,
} from '@src/Input'
import Root, {
  type OtpFieldRootChildrenProps as RootChildrenProps,
  type OtpFieldRootCorvuProps as RootCorvuProps,
  type OtpFieldRootElementProps as RootElementProps,
  type OtpFieldRootProps as RootProps,
  type OtpFieldRootSharedElementProps as RootSharedElementProps,
} from '@src/Root'
import type { DynamicProps } from '@corvu-next/utils/dynamic'

export type {
  RootCorvuProps,
  RootSharedElementProps,
  RootElementProps,
  RootProps,
  RootChildrenProps,
  InputCorvuProps,
  InputSharedElementProps,
  InputElementProps,
  InputProps,
  ContextValue,
  DynamicProps,
}

const OtpField = Object.assign(Root, {
  Input,
  useContext,
})

export default OtpField
export { Input, Root, useContext }
