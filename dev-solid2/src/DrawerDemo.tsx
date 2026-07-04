import Drawer from '@corvu-next/drawer'

export default function DrawerDemo() {
  return (
    <div>
      <h2>Drawer</h2>
      <Drawer side="bottom">
        <Drawer.Trigger style="padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; border: 1px solid #ccc;">
          Open Drawer
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay style="position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999;" />
          <Drawer.Content style="position: fixed; bottom: 0; left: 0; right: 0; background: white; border-radius: 12px 12px 0 0; padding: 1.5rem; z-index: 1000; min-height: 200px; box-shadow: 0 -4px 12px rgba(0,0,0,0.1);">
            <div style="width: 40px; height: 4px; background: #ccc; border-radius: 2px; margin: 0 auto 1rem;" />
            <Drawer.Label style="font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem;">
              Drawer Title
            </Drawer.Label>
            <Drawer.Description style="color: #666; margin-bottom: 1rem;">
              This is a bottom drawer. Drag down to dismiss or click close.
            </Drawer.Description>
            <Drawer.Close style="padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; border: 1px solid #ccc;">
              Close
            </Drawer.Close>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer>
    </div>
  )
}
