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
 * The one way a full layout is written: the panels share whatever their sizes
 * are away from the whole root, each size is rounded to `PRECISION`, and the
 * largest panel carries what that rounding leaves over. So a layout written
 * through here sums to 1 to the places sizes are kept at, with no comparison
 * against 1 anywhere — three thirds come out as `0.333333` twice and
 * `0.333334` once rather than as a total a place short.
 */
const fixLayoutToPrecision = (sizes: number[]) => {
  if (sizes.length === 0) return []
  const totalSize = sizes.reduce((totalSize, size) => totalSize + size, 0)
  const offsetPerPanel = (totalSize - 1) / sizes.length
  // TODO: Recognize min and max sizes
  const fixedSizes = sizes.map((size) => fixToPrecision(size - offsetPerPanel))
  const fixedTotalSize = fixedSizes.reduce(
    (totalSize, size) => totalSize + size,
    0,
  )
  const largestPanel = fixedSizes.reduce(
    (largest, size, index) => (size > fixedSizes[largest]! ? index : largest),
    0,
  )
  fixedSizes[largestPanel] = fixToPrecision(
    fixedSizes[largestPanel]! + 1 - fixedTotalSize,
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
