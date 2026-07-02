import { access, type MaybeAccessor } from '@corvu-next/utils/reactivity'
import { createEffect, createMemo, createSignal, merge, untrack } from 'solid-js'
import { afterPaint } from '@corvu-next/utils/dom'

const focusableElementSelector =
  'a[href]:not([tabindex="-1"]), button:not([tabindex="-1"]), input:not([tabindex="-1"]), textarea:not([tabindex="-1"]), select:not([tabindex="-1"]), details:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'

const EVENT_INITIAL_FOCUS = 'focusTrap.initialFocus'
const EVENT_FINAL_FOCUS = 'focusTrap.finalFocus'
const EVENT_OPTIONS = { bubbles: false, cancelable: true }

/**
 * Traps focus inside the given element. Is aware of changes being made to the DOM tree inside the focus trap by using a `MutationObserver`.
 *
 * @param props.element - Element to trap focus in.
 * @param props.enabled - If the focus trap is enabled. *Default = `true`*
 * @param props.observeChanges - Whether to watch for changes being made to the DOM tree inside the focus trap and reload the focus trap accordingly. *Default = `true`*
 * @param props.initialFocusElement - The element to receive focus when the focus trap is activated. *Default = The first focusable element inside `element`*
 * @param props.restoreFocus - If the focus should be restored to the element the focus was on initially when the focus trap is deactivated. *Default = `true`*
 * @param props.finalFocusElement - The element to receive focus when the focus trap is deactivated (`enabled` = `false`). *Default = The element the focus was on initially*
 * @param props.onInitialFocus - Callback fired when focus moves inside the focus trap. Can be prevented by calling `event.preventDefault`.
 * @param props.onFinalFocus - Callback fired when focus moves outside the focus trap. Can be prevented by calling `event.preventDefault`.
 */
const createFocusTrap = (props: {
  element: MaybeAccessor<HTMLElement | null>
  enabled?: MaybeAccessor<boolean>
  observeChanges?: MaybeAccessor<boolean>
  initialFocusElement?: MaybeAccessor<HTMLElement | null>
  restoreFocus?: MaybeAccessor<boolean>
  finalFocusElement?: MaybeAccessor<HTMLElement | null>
  onInitialFocus?: (event: Event) => void
  onFinalFocus?: (event: Event) => void
}) => {
  const defaultedProps = merge(
    {
      enabled: true,
      observeChanges: true,
      restoreFocus: true,
    },
    props,
  )

  const [focusableElements, setFocusableElements] = createSignal<
    HTMLElement[] | null
  >(null)
  const firstFocusElement = createMemo(() => {
    const _focusableElements = focusableElements()
    if (!_focusableElements) return null
    return _focusableElements[0] ?? null
  })
  const lastFocusElement = createMemo(() => {
    const _focusableElements = focusableElements()
    if (!_focusableElements) return null
    return _focusableElements[_focusableElements.length - 1] ?? null
  })

  let originalFocusedElement: HTMLElement | null = null

  const mutationObserverCallback = () => {
    afterPaint(() => {
      loadFocusTrap(access(defaultedProps.element)!)
      if (
        document.activeElement === null ||
        document.activeElement === document.body
      ) {
        initialFocus(access(defaultedProps.element)!)
      }
    })
  }

  // Effect 1: Main lifecycle — container + enabled → setup trap; cleanup → teardown
  createEffect(
    (prev: undefined | { container: HTMLElement; observeChanges: boolean }) => {
      const container = access(defaultedProps.element)
      const enabled = access(defaultedProps.enabled)
      if (!container || !enabled) return undefined
      const observeChanges = access(defaultedProps.observeChanges)
      return { container, observeChanges }
    },
    (next, prev) => {
      if (!next) return
      const { container, observeChanges } = next

      originalFocusedElement = document.activeElement as HTMLElement | null

      untrack(() => {
        loadFocusTrap(container)
        initialFocus(container)
      })

      let observer: MutationObserver | undefined
      if (observeChanges) {
        observer = new MutationObserver(mutationObserverCallback)
        observer.observe(container, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['tabindex'],
        })
      }

      return () => {
        if (observer) {
          observer.disconnect()
        }
        setFocusableElements(null)
        restoreFocus(container)
      }
    },
  )

  // Effect 2: No focusable elements → prevent Tab from leaving
  createEffect(
    (prev: undefined | boolean) => {
      const _focusableElements = focusableElements()
      if (_focusableElements === null || _focusableElements.length !== 0)
        return false
      return true
    },
    (shouldPrevent) => {
      if (!shouldPrevent) return

      document.addEventListener('keydown', preventFocusChange)
      return () => {
        document.removeEventListener('keydown', preventFocusChange)
      }
    },
  )

  // Effect 3: First focus element → wrap Shift+Tab to last
  createEffect(
    (prev: undefined | HTMLElement | null) => {
      return firstFocusElement()
    },
    (element) => {
      if (!element) return

      element.addEventListener('keydown', onFirstFocusElementKeyDown)
      return () => {
        element.removeEventListener('keydown', onFirstFocusElementKeyDown)
      }
    },
  )

  // Effect 4: Last focus element → wrap Tab to first
  createEffect(
    (prev: undefined | HTMLElement | null) => {
      return lastFocusElement()
    },
    (element) => {
      if (!element) return

      element.addEventListener('keydown', onLastFocusElementKeyDown)
      return () => {
        element.removeEventListener('keydown', onLastFocusElementKeyDown)
      }
    },
  )

  const loadFocusTrap = (container: HTMLElement) => {
    const focusableElements = (
      Array.from(
        container.querySelectorAll(focusableElementSelector),
      ) as HTMLElement[]
    )
      .map((element, domIndex) => ({
        element,
        domIndex,
        tabIndex: element.tabIndex,
      }))
      .sort((a, b) => {
        if (a.tabIndex === b.tabIndex) {
          return a.domIndex - b.domIndex
        }
        return a.tabIndex - b.tabIndex
      })

    setFocusableElements(focusableElements.map(({ element }) => element))
  }

  const initialFocus = (container: HTMLElement) => {
    afterPaint(() => {
      const initialFocusElement =
        access(defaultedProps.initialFocusElement) ??
        firstFocusElement() ??
        container
      const onInitialFocus = defaultedProps.onInitialFocus

      let event: CustomEvent | undefined
      if (onInitialFocus) {
        event = new CustomEvent(EVENT_INITIAL_FOCUS, EVENT_OPTIONS)
        container.addEventListener(EVENT_INITIAL_FOCUS, onInitialFocus)
        container.dispatchEvent(event)
        container.removeEventListener(EVENT_INITIAL_FOCUS, onInitialFocus)
      }

      if (event?.defaultPrevented === true) {
        return
      }

      initialFocusElement.focus()
    })
  }

  const onFirstFocusElementKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault()
      lastFocusElement()!.focus()
    }
  }

  const onLastFocusElementKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      firstFocusElement()!.focus()
    }
  }

  const preventFocusChange = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault()
    }
  }

  const restoreFocus = (container: HTMLElement) => {
    afterPaint(() => {
      const restoreFocus = access(defaultedProps.restoreFocus)
      if (!restoreFocus) return

      const finalFocusElement =
        access(defaultedProps.finalFocusElement) ?? originalFocusedElement

      if (!finalFocusElement) {
        return
      }

      let event: CustomEvent | undefined
      const onFinalFocus = defaultedProps.onFinalFocus
      if (onFinalFocus) {
        event = new CustomEvent(EVENT_FINAL_FOCUS, EVENT_OPTIONS)
        container.addEventListener(EVENT_FINAL_FOCUS, onFinalFocus)
        container.dispatchEvent(event)
        container.removeEventListener(EVENT_FINAL_FOCUS, onFinalFocus)
      }

      if (event?.defaultPrevented === true) {
        return
      }

      finalFocusElement.focus()
    })
  }
}

export default createFocusTrap
