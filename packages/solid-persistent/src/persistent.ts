import { type Accessor, createMemo, getOwner, type Owner, runWithOwner } from 'solid-js'
import type { JSX } from '@solidjs/web'

/**
 * Creates a persistent component that keeps its state and elements cached
 * when removed from the DOM. Call the returned accessor to get the cached
 * element tree — on first call it materializes; subsequent calls return
 * the same memoized tree.
 *
 * @param component - Render function producing the element tree to persist.
 * @returns An accessor returning the persisted JSX element.
 */
const createPersistent = (component: () => JSX.Element): (() => JSX.Element) => {
  let owner: Owner | null = null
  let memoizedComponent: Accessor<JSX.Element> | undefined

  return () => {
    if (!memoizedComponent) {
      owner = getOwner()
      memoizedComponent = runWithOwner(owner, () => createMemo(component))!
    }
    return memoizedComponent()
  }
}

export default createPersistent
