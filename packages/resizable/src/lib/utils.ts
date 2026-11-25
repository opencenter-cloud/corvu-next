import type { PanelInstance } from '@src/lib/types'
import type { Size } from '@corvu-next/utils'

const resolveSize = (size: Size, rootSize: number) => {
  if (typeof size === 'number') {
    return size
  }
  if (!size.endsWith('px')) {
    throw new Error(
      `[corvu] Sizes must be a number or a string ending with 'px'. Got ${size}`,
    )
  }
  return fixToPrecision(parseFloat(size) / rootSize)
}

const splitPanels = (props: {
  panels: PanelInstance[]
  focusedElement: Element
}): [PanelInstance[], PanelInstance[]] => {
  const precedingPanels = props.panels.filter(
    (panel) =>
      !!(
        props.focusedElement.compareDocumentPosition(panel.data.element) &
        Node.DOCUMENT_POSITION_PRECEDING
      ),
  )
  const followingPanels = props.panels.filter(
    (panel) =>
      !!(
        props.focusedElement.compareDocumentPosition(panel.data.element) &
        Node.DOCUMENT_POSITION_FOLLOWING
      ),
  )

  return [precedingPanels, followingPanels]
}

/** The places a panel size is kept to. Every size written to the layout is
 *  rounded here, so the total of a full layout of n panels can sit up to
 *  n * 10 ** -PRECISION away from 1. */
const PRECISION = 6
const fixToPrecision = (value: number) => parseFloat(value.toFixed(PRECISION))

/**
 * The one way a full layout is written: the panels share whatever the layout
 * is away from the whole root, every size is rounded to `PRECISION`, and one
 * panel carries what that rounding leaves over, so the layout sums to 1 to
 * the places sizes are kept at with no comparison against 1 anywhere.
 *
 * Which panel carries it follows `requestedPanel`, the panel whose size this
 * write is of:
 *
 *   - A write of one panel's size — a resize, a collapse, an expand, or a
 *     panel joining the layout — names it. Its size is written as it was
 *     asked for, and the largest of the panels derived from it carries the
 *     remainder.
 *   - A drag over a handle names none (`null`): it asks for no size in
 *     particular, so every panel is derived and the largest of them carries
 *     the remainder. Without that a drag would walk the layout away from 1,
 *     every time it pins a panel to a bound that cannot be kept to
 *     `PRECISION` places.
 *   - A lone panel asked for its own size leaves nothing derived, so nothing
 *     is carried: there is no panel to put the remainder on that was not
 *     asked for.
 *
 * A panel mounting from `initialSizes` into a layout that is not full does
 * not come through here at all; the consumer's entries are handed on rounded.
 */
const fixLayoutToPrecision = (
  sizes: number[],
  requestedPanel: number | null,
) => {
  const derivedPanels = sizes
    .map((_, index) => index)
    .filter((index) => index !== requestedPanel)
  if (derivedPanels.length === 0) return sizes.map(fixToPrecision)

  const totalSize = sizes.reduce((totalSize, size) => totalSize + size, 0)
  const offsetPerPanel = (totalSize - 1) / derivedPanels.length
  // TODO: Recognize min and max sizes
  const fixedSizes = sizes.map((size, index) =>
    fixToPrecision(index === requestedPanel ? size : size - offsetPerPanel),
  )
  const fixedTotalSize = fixedSizes.reduce(
    (totalSize, size) => totalSize + size,
    0,
  )
  const largestDerivedPanel = derivedPanels.reduce((largest, index) =>
    fixedSizes[index]! > fixedSizes[largest]! ? index : largest,
  )
  fixedSizes[largestDerivedPanel] = fixToPrecision(
    fixedSizes[largestDerivedPanel]! + 1 - fixedTotalSize,
  )
  return fixedSizes
}

export {
  resolveSize,
  splitPanels,
  fixToPrecision,
  fixLayoutToPrecision,
  PRECISION,
}
