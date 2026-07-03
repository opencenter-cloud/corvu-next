import Resizable from '@corvu-next/resizable'

export default function ResizableDemo() {
  return (
    <div>
      <h2>Resizable</h2>
      <p>Drag the handle between panels to resize.</p>
      <Resizable style="display: flex; height: 200px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;">
        <Resizable.Panel
          initialSize={0.5}
          minSize={0.2}
          style="background: #e3f2fd; display: flex; align-items: center; justify-content: center;"
        >
          Panel 1
        </Resizable.Panel>
        <Resizable.Handle style="width: 4px; background: #90caf9; cursor: col-resize;" />
        <Resizable.Panel
          initialSize={0.5}
          minSize={0.2}
          style="background: #fce4ec; display: flex; align-items: center; justify-content: center;"
        >
          Panel 2
        </Resizable.Panel>
      </Resizable>
    </div>
  )
}
