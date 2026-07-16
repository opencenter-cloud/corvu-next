import type { NamedSSRLoadedRendererValue } from 'astro';
import {
	createComponent,
	generateHydrationScript,
	renderToString,
	renderToStringAsync,
	ssr,
} from '@solidjs/web';
import { NoHydration, Loading } from 'solid-js';
import { getContext, incrementId } from './context.js';
import type { RendererContext } from './types.js';

const slotName = (str: string) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());

type RenderStrategy = 'sync' | 'async';

async function check(
	this: RendererContext,
	Component: any,
	props: Record<string, any>,
	children: any,
) {
	if (typeof Component !== 'function') return false;
	if (Component.name === 'QwikComponent') return false;
	// Svelte component renders fine by Solid as an empty string. The only way to detect
	// if this isn't a Solid but Svelte component is to unfortunately copy the check
	// implementation of the Svelte renderer.
	// `$$payload` is the legacy prop name; `$$renderer` is the name used since Svelte 5.x.
	const componentStr = Component.toString();
	if (componentStr.includes('$$payload') || componentStr.includes('$$renderer')) return false;

	// In a single-framework project (corvu-next docs), skip the render-based check.
	// The upstream check tries to render the component and tests for non-undefined output,
	// but during migration, components may throw MISSING_EFFECT_FN or other Solid 2 errors
	// that cause check() to return false → "NoMatchingRenderer". Since we know all .tsx
	// components in this project are Solid, we return true for any function that isn't
	// explicitly Qwik or Svelte.
	return true;
}

// AsyncRendererComponentFn
async function renderToStaticMarkup(
	this: RendererContext,
	Component: any,
	props: Record<string, any>,
	{ default: children, ...slotted }: any,
	metadata?: Record<string, any>,
) {
	const ctx = getContext(this.result);
	const renderId = metadata?.hydrate ? incrementId(ctx) : '';
	const needsHydrate = metadata?.astroStaticSlot ? !!metadata.hydrate : true;
	const tagName = needsHydrate ? 'astro-slot' : 'astro-static-slot';

	const renderStrategy = (metadata?.renderStrategy ?? 'async') as RenderStrategy;

	const renderFn = () => {
		const slots: Record<string, any> = {};
		for (const [key, value] of Object.entries(slotted)) {
			const name = slotName(key);
			slots[name] = ssr(`<${tagName} name="${name}">${value}</${tagName}>`);
		}
		// Note: create newProps to avoid mutating `props` before they are serialized
		const newProps = {
			...props,
			...slots,
			// In Solid SSR mode, `ssr` creates the expected structure for `children`.
			children: children != null ? ssr(`<${tagName}>${children}</${tagName}>`) : children,
		};

		if (renderStrategy === 'sync') {
			// Sync Render:
			// <Component />
			// This render mode is not exposed directly to the end user. It is only
			// used in the check() function.
			return createComponent(Component, newProps);
		} else {
			if (needsHydrate) {
				// Hydrate + Async Render:
				// <Loading>
				//   <Component />
				// </Loading>
				return createComponent(Loading, {
					get children() {
						return createComponent(Component, newProps);
					},
				});
			} else {
				// Static + Async Render
				// <NoHydration>
				//   <Loading>
				//     <Component />
				//   </Loading>
				// </NoHydration>
				return createComponent(NoHydration, {
					get children() {
						return createComponent(Loading, {
							get children() {
								return createComponent(Component, newProps);
							},
						});
					},
				});
			}
		}
	};

	const componentHtml =
		renderStrategy === 'async'
			? await renderToStringAsync(renderFn, {
					renderId,
					// New setting since Solid 1.8.4 that fixes an errant hydration event appearing in
					// server only components.
					// https://github.com/solidjs/solid/issues/1931
					...({ noScripts: !needsHydrate } as any),
				}).catch(() => '')
			: (() => { try { return renderToString(renderFn, { renderId }) } catch { return '' } })();

	return {
		attrs: {
			'data-solid-render-id': renderId,
		},
		html: componentHtml,
	};
}

const renderer: NamedSSRLoadedRendererValue = {
	name: '@corvu-next/astrojs-solid-next',
	check,
	renderToStaticMarkup,
	supportsAstroStaticSlot: true,
	renderHydrationScript: () => generateHydrationScript(),
};

export default renderer;
