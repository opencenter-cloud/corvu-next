import './index.css'
import Drawer from '@corvu-next/drawer'
import type { Component } from 'solid-js'

const DrawerExample: VoidComponent = () => {
  return (
    <Drawer breakPoints={[0.75]}>
      {(props) => (
        <>
          <Drawer.Trigger>Open Drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay
              style={{
                'background-color': `rgb(0 0 0 / ${
                  0.5 * props.openPercentage
                })`,
              }}
            />
            <Drawer.Content>
              <div class="notch" />
              <Drawer.Label>I'm a drawer!</Drawer.Label>
              <Drawer.Description>Drag down to close me.</Drawer.Description>
              <p class="hidden_frog">🐸 You found froggy!</p>
            </Drawer.Content>
          </Drawer.Portal>
        </>
      )}
    </Drawer>
  )
}

export default DrawerExample
