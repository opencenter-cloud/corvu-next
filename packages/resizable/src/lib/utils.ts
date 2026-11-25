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

/** The size a collapsible panel rests at when it is collapsed, as the layout
 *  stores it. Every comparison of a stored size with the collapsed size goes
 *  through here, so a collapsed size of a eleventh, which no layout can store
 *  as it is, still reads as collapsed. */
const storedCollapsedSize = (collapsedSize: Size, rootSize: number) =>
  fixToPrecision(resolveSize(collapsedSize, rootSize))

/**
 * The sizes a panel may be reported at: anything from `minSize` to `maxSize`,
 * and, for a collapsible panel, its collapsed size — never the gap between
 * the collapsed size and the minimum. `collapsedSize` is `null` for a panel
 * that cannot collapse.
 */
type PanelSizeConstraints = {
  minSize: number
  maxSize: number
  collapsedSize: number | null
}

const panelSizeConstraints = (
  panel: PanelInstance,
  rootSize: number,
): PanelSizeConstraints => ({
  minSize: resolveSize(panel.data.minSize, rootSize),
  maxSize: resolveSize(panel.data.maxSize, rootSize),
  collapsedSize: panel.data.collapsible
    ? storedCollapsedSize(panel.data.collapsedSize ?? 0, rootSize)
    : null,
})

/** Where a size may sit, decided from the size the write itself produced,
 *  before this step shares out whatever the layout is away from the root. A
 *  collapsible panel the write leaves below the middle of its gap is
 *  collapsed, and a collapsed panel is pinned at its collapsed size with no
 *  room either way, so a share of that sharing-out never opens it; anywhere
 *  above that middle the panel is open and its bounds are its minimum and
 *  maximum. */
type PanelSizeBounds = { minSize: number; maxSize: number }

const sizeBounds = (
  size: number,
  constraints: PanelSizeConstraints,
): PanelSizeBounds => {
  if (
    constraints.collapsedSize !== null &&
    size < (constraints.collapsedSize + constraints.minSize) / 2
  ) {
    return {
      minSize: constraints.collapsedSize,
      maxSize: constraints.collapsedSize,
    }
  }
  return { minSize: constraints.minSize, maxSize: constraints.maxSize }
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

/** The size a panel ends at when it takes the remainder: as much of it as its
 *  own bounds allow, which is none of it for a panel already pinned in that
 *  direction and all of it for one with room to spare. */
const sizeCarrying = (
  size: number,
  remainder: number,
  bounds: PanelSizeBounds,
) => fixSizeToPrecision(size + remainder, bounds)

/** Sizes and panels describe the same layout, so the two lists always match.
 *  A missing panel would quietly take every bound with it. */
const checkPanelCount = (
  sizes: number[],
  constraints: PanelSizeConstraints[],
) => {
  if (constraints.length !== sizes.length) {
    throw new Error(
      `[corvu] A layout of ${sizes.length} sizes was written with ${constraints.length} panels' constraints. They describe the same panels, so the two always match.`,
    )
  }
}

/** Every size rounded to `PRECISION` and into the sizes its panel may be
 *  reported at, with the total left where it is: a layout the consumer has
 *  not filled yet — the panels of the first frame taking their `initialSizes`
 *  entries — stays as they described it. */
const fixSizesToPrecision = (
  sizes: number[],
  constraints: PanelSizeConstraints[],
) => {
  checkPanelCount(sizes, constraints)
  return sizes.map((size, index) =>
    fixSizeToPrecision(size, sizeBounds(size, constraints[index]!)),
  )
}

/**
 * The one way a full layout is written: the panels share whatever the layout
 * is away from the whole root, every size is rounded to `PRECISION` and into
 * the sizes its panel may be reported at, and one panel carries what that
 * rounding leaves over, so the layout sums to 1 to the places sizes are kept
 * at with no comparison against 1 anywhere.
 *
 * Which panels carry it follows `requested`, the sizes this write is of —
 * one for a resize, several where a layout holds more than one panel where
 * it is, a bound or a size the panels described:
 *
 *   - A write of one panel's size — a resize, a collapse, an expand, or a
 *     panel joining the layout — names it. When the layout could give that
 *     size, it is written as it was asked for and the remainder goes to the
 *     panels derived from it. When the layout could not — a resize or a join
 *     the other panels' bounds cut short — the size that comes out is derived
 *     like any other, and that panel carries too.
 *   - A drag over a handle names none (`null`): it asks for no size in
 *     particular, so every panel is derived. Without that a drag would walk
 *     the layout away from 1, every time it pins a panel to a bound that
 *     cannot be kept to `PRECISION` places.
 *   - A lone panel asked for its own size leaves nothing derived, so nothing
 *     is carried: there is no panel to put the remainder on that was not
 *     asked for.
 *
 * The derived panels carry in turn, the largest of them first and on a tie
 * the first of them, each taking as much of what is left as its own bounds
 * allow and passing the rest to the next. So the layout stays away from the
 * root only when every derived panel is pinned in the direction the remainder
 * would move it.
 *
 * The request and the bounds come before the total. Rounding a size into the
 * sizes it may be reported at moves it by less than 10 ** -PRECISION, so a
 * layout that carries nothing is at most n * 10 ** -PRECISION from 1, which
 * still counts as a full layout, and the next write with room in it brings
 * the total back. The one way a layout leaves 1 by more than that is bounds
 * of the consumer's that cannot all hold together: minimums summing past 1
 * leave every panel at its minimum and the total at their sum, and maximums
 * that cannot take the size an unmounting panel gives up leave every panel at
 * its maximum. Their bounds win, and the layout they describe is reported.
 *
 * Every write of a full layout comes through here: a resize, a collapse, an
 * expand, a drag, a key, a panel joining a full layout and the panels that
 * stay when one unmounts, a controlled root's own resizes and drags included.
 * A panel joining a layout that is not full does not share anything out:
 * `fixSizesToPrecision` rounds what the consumer described into the sizes
 * their panels may rest at, and that is the layout. Where what they described
 * does not fit the root — entries summing past it, a panel asking for more
 * than the room that is left, or a bound raising a panel — the caller comes
 * back here with the panel a bound raised asking for that bound, if there is
 * one, and every other panel shares what is over. No panel is singled out for
 * having registered last, so the layout is the same whichever panel of a
 * frame that was.
 */
const fixLayoutToPrecision = (props: {
  sizes: number[]
  constraints: PanelSizeConstraints[]
  requested: { panel: number; size: number }[]
}) => {
  checkPanelCount(props.sizes, props.constraints)

  // A size the layout could not give is not a size anyone was given: the
  // panel that asked for it holds a derived size like every other panel. The
  // rest are held at the size they were given, and what the layout is away
  // from the root is shared between the panels nobody asked anything of.
  const heldPanels = props.requested
    .filter(
      ({ panel, size }) =>
        fixToPrecision(props.sizes[panel]!) === fixToPrecision(size),
    )
    .map(({ panel }) => panel)

  const derivedPanels = props.sizes
    .map((_, index) => index)
    .filter((index) => !heldPanels.includes(index))
  const totalSize = props.sizes.reduce((totalSize, size) => totalSize + size, 0)
  const offsetPerPanel =
    derivedPanels.length === 0 ? 0 : (totalSize - 1) / derivedPanels.length

  const bounds = props.sizes.map((size, index) =>
    sizeBounds(size, props.constraints[index]!),
  )
  const writtenSizes = props.sizes.map((size, index) =>
    heldPanels.includes(index) ? size : size - offsetPerPanel,
  )
  const fixedSizes = writtenSizes.map((size, index) =>
    fixSizeToPrecision(size, bounds[index]!),
  )
  if (derivedPanels.length === 0) return fixedSizes

  const remainder = fixToPrecision(
    1 - fixedSizes.reduce((totalSize, size) => totalSize + size, 0),
  )
  if (remainder === 0) return fixedSizes

  // The derived panels take what is left over in turn, largest first and, on
  // a tie, the first of them, each as much of it as its own bounds allow.
  // What one cannot take passes to the next, so the layout only stays away
  // from the root when every one of them is pinned in that direction.
  const carryingOrder = [...derivedPanels].sort(
    (panel, otherPanel) => fixedSizes[otherPanel]! - fixedSizes[panel]!,
  )
  let sizeLeftOver = remainder
  for (const index of carryingOrder) {
    if (sizeLeftOver === 0) break
    const carriedSize = sizeCarrying(
      fixedSizes[index]!,
      sizeLeftOver,
      bounds[index]!,
    )
    sizeLeftOver = fixToPrecision(
      sizeLeftOver - (carriedSize - fixedSizes[index]!),
    )
    fixedSizes[index] = carriedSize
  }
  return fixedSizes
}

export {
  resolveSize,
  splitPanels,
  fixToPrecision,
  fixLayoutToPrecision,
  fixSizesToPrecision,
  panelSizeConstraints,
  storedCollapsedSize,
  PRECISION,
}
export type { PanelSizeConstraints }
