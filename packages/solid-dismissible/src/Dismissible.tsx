import {
  type Accessor,
  type Component,
  createContext,
  createSignal,
  createUniqueId,
  omit,
  onCleanup,
  useContext,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { access, mergeDefaults } from '@corvu-next/utils/reactivity'
import createDismissible from '@src/create/dismissible'
import type { CreateDismissibleProps } from '@src/create/dismissible'
import { isFunction } from '@corvu-next/utils'

/** What a layer tells the stacks about itself: both are read where the stack
 *  is read, so a layer that is enabled, or renamed, is in the stack in the
 *  flush that changed it. */
type LayerRegistration = {
  id: Accessor<string>
  enabled: Accessor<boolean>
}

type DismissibleContextValue = {
  layers: Accessor<string[]>
  registerLayer: (registration: LayerRegistration) => void
}

const DismissibleContext = createContext<DismissibleContextValue | null>(null)

/** Adds a layer to a list for as long as the component that calls this
 *  lives. The list is ordered by the order the layers mounted in, which is
 *  the order they are nested in: corvu mounts a dismissible with the content
 *  it dismisses. */
const registerLayerIn = (
  setRegistrations: (
    update: (registrations: LayerRegistration[]) => LayerRegistration[],
  ) => unknown,
  registration: LayerRegistration,
) => {
  setRegistrations((registrations) => [...registrations, registration])
  onCleanup(() =>
    setRegistrations((registrations) =>
      registrations.filter((entry) => entry !== registration),
    ),
  )
}

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
  const defaultedProps = mergeDefaults(
    {
      dismissibleId: createUniqueId(),
    },
    props,
  )

  const dismissibleContext = useContext(DismissibleContext)
  if (dismissibleContext !== null) {
    return (<DismissibleLayer {...props} />) as unknown as JSX.Element
  }

  /** The layers of this stack, derived from what they are rather than kept
   *  in sync by an effect: an effect that wrote the stack made every reader
   *  of it run twice for one write of `enabled` — once against the stack as
   *  it was, once after the write landed (`EFFECT_RELAY_TEAR`) — so the
   *  frame a dialog opened in still named the layer below it as the last
   *  one. */
  const [registrations, setRegistrations] = createSignal<LayerRegistration[]>(
    [],
    { ownedWrite: true },
  )

  const layers = () =>
    registrations()
      .filter((layer) => layer.enabled())
      .map((layer) => layer.id())

  return (
    <DismissibleContext
      value={{
        layers,
        registerLayer: (registration) =>
          registerLayerIn(setRegistrations, registration),
      }}
    >
      <DismissibleLayer {...props} />
    </DismissibleContext>
  ) as unknown as JSX.Element
}

/** Every dismissible layer on the page, in the order they mounted. */
const [dismissibleRegistrations, setDismissibleRegistrations] = createSignal<
  LayerRegistration[]
>([], { ownedWrite: true })

/** The ids of the layers that are enabled, innermost last. */
const activeDismissibles = () =>
  dismissibleRegistrations()
    .filter((layer) => layer.enabled())
    .map((layer) => layer.id())

const DismissibleLayer: Component<DismissibleProps> = (props) => {
  const defaultedProps = mergeDefaults(
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

  // `createDismissible` takes none of these. `dismissibleId` is among them:
  // `otherProps` is spread into an object literal below, which reads every
  // key it still carries once and untracked, so leaving the id in it both
  // raises `STRICT_READ_UNTRACKED` for a reactive one and hands
  // `createDismissible` a prop it has no use for.
  const otherProps = omit(defaultedProps,
    'enabled',
    'dismissibleId',
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

  /** What this layer is, read wherever a stack is read: an id a consumer
   *  changes, or an `enabled` they flip, reaches both stacks in that flush,
   *  and the layer leaves them when it unmounts. */
  const registration: LayerRegistration = {
    id: () => defaultedProps.dismissibleId,
    enabled: () => defaultedProps.enabled,
  }
  context.registerLayer(registration)
  registerLayerIn(setDismissibleRegistrations, registration)

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

  const resolveChildren = () => {
    const children = defaultedProps.children
    if (isFunction(children)) {
      return children({
        get isLastLayer() {
          return isLastLayer()
        },
      })
    }
    return children
  }

  return resolveChildren() as unknown as JSX.Element
}

export { activeDismissibles }

export default Dismissible
