import { merge } from 'solid-js'

/**
 * The props a component works with once its defaults are filled in: every key
 * the consumer passed that the defaults do not name, and every key the
 * defaults name, at the consumer's value where they gave one and at the
 * default where they did not.
 */
type DefaultedProps<Defaults extends object, Props extends object> = Omit<
  Props,
  keyof Defaults
> & {
  [Key in keyof Defaults]: Defaults[Key] | DefaultedValue<Defaults, Props, Key>
}

type DefaultedValue<
  Defaults extends object,
  Props extends object,
  Key extends keyof Defaults,
> = Key extends keyof Props ? Exclude<Props[Key], undefined> : never

/**
 * Merges defaults with a consumer's props, where a prop the consumer passed
 * as `undefined` takes the default.
 *
 * Solid 1's `mergeProps` took the last source whose value for a key was not
 * `undefined`, so `<Dialog trapFocus={props.trapFocus} />` with nothing of
 * their own to pass kept corvu's default. Solid 2's `merge` takes the last
 * source that *has* the key, `undefined` included, so the same call would
 * turn the default off — and a component forwarding an optional prop it was
 * not given is the ordinary way to write one. corvu's contract is that
 * `undefined` means "use the default", so every default in these packages is
 * merged through here.
 *
 * The result is a live view, as `merge` returns: the defaults are read where
 * they are written, a prop's getter runs on each read, and nothing is copied.
 * A default that is a function is a value like any other — the thunk defaults
 * these packages use for defaults derived from another prop are handed on
 * untouched, for `access` to resolve.
 */
const mergeDefaults = <Defaults extends object, Props extends object>(
  defaults: Defaults,
  props: Props,
): DefaultedProps<Defaults, Props> => {
  // One getter per default, as the last source: the keys the defaults name
  // are answered here, every other key by `props`. The getter reads the prop
  // on each read, so a prop that becomes defined later — or `undefined`
  // again — is followed, and reading it inside a computation tracks it.
  const defaultedValues = {} as Record<string | symbol, unknown>
  for (const key of Reflect.ownKeys(defaults)) {
    Object.defineProperty(defaultedValues, key, {
      enumerable: true,
      configurable: true,
      get: () => {
        const value = (props as Record<string | symbol, unknown>)[key]
        return value === undefined
          ? (defaults as Record<string | symbol, unknown>)[key]
          : value
      },
    })
  }

  return merge(defaults, props, defaultedValues) as DefaultedProps<
    Defaults,
    Props
  >
}

export default mergeDefaults
export type { DefaultedProps }
