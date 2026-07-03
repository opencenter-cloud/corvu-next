import {
  type Component,
  omit,
} from 'solid-js'
import type { ValidComponent } from '@solidjs/web'
import { dataIf, type Side } from '@corvu-next/utils'
import Dialog, {
  type OverlayCorvuProps as DialogOverlayCorvuProps,
  type OverlayElementProps as DialogOverlayElementProps,
  type OverlaySharedElementProps as DialogOverlaySharedElementProps,
} from '@corvu-next/dialog'
import type { DynamicProps } from '@corvu-next/utils/dynamic'
import { useInternalDrawerContext } from '@src/context'

export type DrawerOverlayCorvuProps = DialogOverlayCorvuProps

export type DrawerOverlaySharedElementProps<T extends ValidComponent = 'div'> =
  DialogOverlaySharedElementProps<T>

export type DrawerOverlayElementProps = DrawerOverlaySharedElementProps & {
  'data-side': Side
  'data-opening': '' | undefined
  'data-closing': '' | undefined
  'data-snapping': '' | undefined
  'data-transitioning': '' | undefined
  'data-resizing': '' | undefined
  'data-corvu-drawer-overlay': ''
} & DialogOverlayElementProps

export type DrawerOverlayProps<T extends ValidComponent = 'div'> =
  DrawerOverlayCorvuProps & Partial<DrawerOverlaySharedElementProps<T>>

/** Component which can be used to create a faded background. Can be animated.
 *
 * @data `data-corvu-drawer-overlay` - Present on every drawer overlay element.
 * @data `data-open` - Present when the drawer is open.
 * @data `data-closed` - Present when the drawer is closed.
 * @data `data-side` - The side that the drawer attached on.
 * @data `data-opening` - Present when the drawer is in the open transition.
 * @data `data-closing` - Present when the drawer is in the close transition.
 * @data `data-snapping` - Present when the drawer is transitioning after the user stops dragging.
 * @data `data-transitioning` - Present when the drawer is transitioning (opening, closing or snapping).
 * @data `data-resizing` - Present when the drawer is transitioning after the size (width/height) changes. Only present if `transitionResize` is set to `true`.
 */
const DrawerOverlay = <T extends ValidComponent = 'div'>(
  props: DynamicProps<T, DrawerOverlayProps<T>>,
) => {
  const otherProps = omit(props as DrawerOverlayProps,
    'contextId',
  )

  const drawerContext = useInternalDrawerContext((props as DrawerOverlayProps).contextId)

  return (
    <Dialog.Overlay<
      Component<
        Omit<DrawerOverlayElementProps, keyof DialogOverlayElementProps>
      >
    >
      contextId={(props as DrawerOverlayProps).contextId}
      // === ElementProps ===
      data-side={drawerContext.side()}
      data-opening={dataIf(drawerContext.transitionState() === 'opening')}
      data-closing={dataIf(drawerContext.transitionState() === 'closing')}
      data-snapping={dataIf(drawerContext.transitionState() === 'snapping')}
      data-transitioning={dataIf(drawerContext.isTransitioning())}
      data-resizing={dataIf(drawerContext.transitionState() === 'resizing')}
      data-corvu-drawer-overlay=""
      // === Misc ===
      data-corvu-dialog-overlay={null}
      {...otherProps}
    />
  )
}

export default DrawerOverlay
