import {
  type Accessor,
  type Component,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  merge,
  omit,
  untrack,
  useContext,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { access } from '@corvu-next/utils/reactivity'
import createDismissible from '@src/create/dismissible'
import type { CreateDismissibleProps } from '@src/create/dismissible'
import { isFunction } from '@corvu-next/utils'

type DismissibleContextValue = {
  layers: Accessor<string[]>
  onLayerShow: (newLayer: string) => void
  onLayerDismiss: (dismissedLayer: string) => void
}

const DismissibleContext = createContext<DismissibleContextValue>()

export type DismissibleProps = {
  /**
   * Whether the dismissible is enabled.
   * @defaultValue `true`
   */
  enabled: boolean
  dismissibleId?: string
  /** @hidden */
  children: JSX.Element | ((props: DismissibleChildrenProps) => JSX.Element)
} & CreateDismissibleProps

export type DismissibleChildrenProps = {
  isLastLayer: boolean
}

/** A component that can be dismissed by pressing the escape key or clicking outside of it. Can be nested. */
const Dismissible: Component<DismissibleProps> = (props) => {
  const defaultedProps = merge(
    {
      dismissibleId: createUniqueId(),
    },
    props,
  )

  const memoizedDismissible = createMemo(() => {
    const dismissibleContext = useContext(DismissibleContext)
    if (dismissibleContext) {
      return <DismissibleLayer {...props} />
    }

    const [layers, setLayers] = createSignal<string[]>([
      defaultedProps.dismissibleId,
    ])

    const onLayerShow = (dismissibleId: string) => {
      setLayers((layers) => [...layers, dismissibleId])
    }

    const onLayerDismiss = (dismissibleId: string) => {
      setLayers((layers) => layers.filter((layer) => layer !== dismissibleId))
    }

    return (
      <DismissibleContext
        value={{
          layers,
          onLayerShow,
          onLayerDismiss,
        }}
      >
        <DismissibleLayer {...props} />
      </DismissibleContext>
    )
  })

  return memoizedDismissible as unknown as JSX.Element
}

const [activeDismissibles, setActiveDismissibles] = createSignal<string[]>([])

const DismissibleLayer: Component<DismissibleProps> = (props) => {
  const defaultedProps = merge(
    {
      enabled: true,
      dismissibleId: createUniqueId(),
      dismissOnEscapeKeyDown: true,
      dismissOnOutsideFocus: true,
      dismissOnOutsidePointer: true,
      outsidePointerStrategy: 'pointerup' as const,
      noOutsidePointerEvents: true,
    },
    props,
  )

  const otherProps = omit(defaultedProps,
    'enabled',
    'children',
    'dismissOnEscapeKeyDown',
    'dismissOnOutsideFocus',
    'dismissOnOutsidePointer',
    'outsidePointerStrategy',
    'outsidePointerIgnore',
    'noOutsidePointerEvents',
    'onDismiss',
  )

  const context = useContext(DismissibleContext) as DismissibleContextValue

  createEffect(
    () => defaultedProps.enabled,
    (enabled) => {
      if (enabled) {
        context.onLayerShow(defaultedProps.dismissibleId)
        setActiveDismissibles((activeDismissibles) => [
          ...activeDismissibles,
          defaultedProps.dismissibleId,
        ])
      } else {
        context.onLayerDismiss(defaultedProps.dismissibleId)
        setActiveDismissibles((activeDismissibles) =>
          activeDismissibles.filter(
            (dismissibleId) => dismissibleId !== defaultedProps.dismissibleId,
          ),
        )
      }

      return () => {
        context.onLayerDismiss(defaultedProps.dismissibleId)
        setActiveDismissibles((activeDismissibles) =>
          activeDismissibles.filter(
            (dismissibleId) => dismissibleId !== defaultedProps.dismissibleId,
          ),
        )
      }
    },
  )

  const isLastLayer = () => {
    return (
      context.layers()[context.layers().length - 1] ===
      defaultedProps.dismissibleId
    )
  }

  createDismissible({
    dismissOnEscapeKeyDown: () =>
      access(defaultedProps.dismissOnEscapeKeyDown) &&
      isLastLayer() &&
      defaultedProps.enabled,
    dismissOnOutsideFocus: () =>
      access(defaultedProps.dismissOnOutsideFocus) &&
      isLastLayer() &&
      defaultedProps.enabled,
    dismissOnOutsidePointer: () =>
      access(defaultedProps.dismissOnOutsidePointer) &&
      isLastLayer() &&
      defaultedProps.enabled,
    outsidePointerStrategy: defaultedProps.outsidePointerStrategy,
    outsidePointerIgnore: defaultedProps.outsidePointerIgnore,
    noOutsidePointerEvents: () =>
      access(defaultedProps.noOutsidePointerEvents) && defaultedProps.enabled,
    onDismiss: (reason) => {
      defaultedProps.onDismiss(reason)
    },
    ...otherProps,
  })

  const memoizedChildren = createMemo(() => defaultedProps.children)

  const resolveChildren = () => {
    const children = memoizedChildren()
    if (isFunction(children)) {
      return children({
        get isLastLayer() {
          return isLastLayer()
        },
      })
    }
    return children
  }

  return untrack(() => resolveChildren())
}

export { activeDismissibles }

export default Dismissible
