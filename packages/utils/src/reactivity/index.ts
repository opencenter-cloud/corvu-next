import { access, chain, mergeRefs, some } from '@src/reactivity/lib'
import type { DefaultedProps } from '@src/reactivity/defaults'
import type { MaybeAccessor, MaybeAccessorValue } from '@src/reactivity/types'
import mergeDefaults from '@src/reactivity/defaults'

export type { DefaultedProps, MaybeAccessor, MaybeAccessorValue }

export { access, chain, mergeDefaults, mergeRefs, some }
