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

/** Where a panel's size may sit, resolved against the root. A collapsible
 *  panel rests at its collapsed size, which is below its minimum, so that is
 *  its floor. */
type PanelSizeBounds = { minSize: number; maxSize: number }

const panelSizeBounds = (
  panel: PanelInstance,
  rootSize: number,
): PanelSizeBounds => {
  const minSize = resolveSize(panel.data.minSize, rootSize)
  const collapsedSize = resolveSize(panel.data.collapsedSize ?? 0, rootSize)
  return {
    minSize: panel.data.collapsible ? Math.min(minSize, collapsedSize) : minSize,
    maxSize: resolveSize(panel.data.maxSize, rootSize),
  }
}

/** The smallest value of `PRECISION` places at or above `value`, and the
 *  largest at or below it. A bound of the consumer's — a seventh, say — is
 *  rarely a value of six places, and rounding a size that sits on one to the
 *  nearest would report it outside the bound it is pinned to. */
const ceilToPrecision = (value: number) => {
  const fixedValue = fixToPrecision(value)
  return fixedValue >= value
    ? fixedValue
    : fixToPrecision(fixedValue + 10 ** -PRECISION)
}

const floorToPrecision = (value: number) => {
  const fixedValue = fixToPrecision(value)
  return fixedValue <= value
    ? fixedValue
    : fixToPrecision(fixedValue - 10 ** -PRECISION)
}

/** A size rounded to `PRECISION` and never out of the panel's bounds: one
 *  pinned to a minimum rounds up, one pinned to a maximum rounds down. Bounds
 *  with no six-place value between them are left to the plain rounding, since
 *  nothing can be reported that honours both. */
const fixSizeToPrecision = (size: number, bounds: PanelSizeBounds) => {
  const fixedSize = fixToPrecision(size)
  const lowestSize = ceilToPrecision(bounds.minSize)
  const highestSize = floorToPrecision(bounds.maxSize)
  if (lowestSize > highestSize) return fixedSize
  return Math.min(Math.max(fixedSize, lowestSize), highestSize)
}

/** Whether a panel can take the remainder and stay within its bounds. */
const hasRoomFor = (
  size: number,
  remainder: number,
  bounds: PanelSizeBounds,
) => {
  const carriedSize = fixToPrecision(size + remainder)
  return remainder > 0
    ? carriedSize <= floorToPrecision(bounds.maxSize)
    : carriedSize >= ceilToPrecision(bounds.minSize)
}

/**
 * The one way a full layout is written: the panels share whatever the layout
 * is away from the whole root, every size is rounded to `PRECISION` and into
 * its own bounds, and one panel carries what that rounding leaves over, so
 * the layout sums to 1 to the places sizes are kept at with no comparison
 * against 1 anywhere.
 *
 * Which panel carries it follows `requestedPanel`, the panel whose size this
 * write is of:
 *
 *   - A write of one panel's size — a resize, a collapse, an expand, or a
 *     panel joining the layout — names it. Its size is written as it was
 *     asked for, and the remainder goes to the largest panel derived from it
 *     that has room for it inside its own bounds; on a tie, the first of
 *     them.
 *   - A drag over a handle names none (`null`): it asks for no size in
 *     particular, so every panel is derived and the largest with room carries
 *     the remainder. Without that a drag would walk the layout away from 1,
 *     every time it pins a panel to a bound that cannot be kept to
 *     `PRECISION` places.
 *   - A lone panel asked for its own size leaves nothing derived, so nothing
 *     is carried: there is no panel to put the remainder on that was not
 *     asked for.
 *
 * Bounds come before the total. When no derived panel has room — each of them
 * pinned to a bound in the direction the remainder would move it — nothing is
 * carried and the layout is handed on as it is. Rounding a size into its
 * bounds moves it by less than 10 ** -PRECISION, so the total is then at most
 * n * 10 ** -PRECISION from 1, which still counts as a full layout, and the
 * next write with room in it brings the total back.
 *
 * A panel mounting from `initialSizes` into a layout that is not full does
 * not come through here at all; the consumer's entries are handed on rounded.
 */
const fixLayoutToPrecision = (
  sizes: number[],
  requestedPanel: number | null,
  bounds: PanelSizeBounds[],
) => {
  const boundsOf = (index: number) =>
    bounds[index] ?? { minSize: 0, maxSize: 1 }
  const derivedPanels = sizes
    .map((_, index) => index)
    .filter((index) => index !== requestedPanel)
  if (derivedPanels.length === 0) {
    return sizes.map((size, index) => fixSizeToPrecision(size, boundsOf(index)))
  }

  const totalSize = sizes.reduce((totalSize, size) => totalSize + size, 0)
  const offsetPerPanel = (totalSize - 1) / derivedPanels.length
  const fixedSizes = sizes.map((size, index) =>
    fixSizeToPrecision(
      index === requestedPanel ? size : size - offsetPerPanel,
      boundsOf(index),
    ),
  )

  const remainder = fixToPrecision(
    1 - fixedSizes.reduce((totalSize, size) => totalSize + size, 0),
  )
  if (remainder === 0) return fixedSizes

  const panelsWithRoom = derivedPanels.filter((index) =>
    hasRoomFor(fixedSizes[index]!, remainder, boundsOf(index)),
  )
  if (panelsWithRoom.length === 0) return fixedSizes

  const carryingPanel = panelsWithRoom.reduce((largest, index) =>
    fixedSizes[index]! > fixedSizes[largest]! ? index : largest,
  )
  fixedSizes[carryingPanel] = fixToPrecision(
    fixedSizes[carryingPanel]! + remainder,
  )
  return fixedSizes
}

export {
  resolveSize,
  splitPanels,
  fixToPrecision,
  fixLayoutToPrecision,
  panelSizeBounds,
  PRECISION,
}
export type { PanelSizeBounds }
