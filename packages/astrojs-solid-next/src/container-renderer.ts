import type { AstroRenderer } from 'astro';

export function getContainerRenderer(): AstroRenderer {
	return {
		name: '@corvu-next/astrojs-solid-next',
		clientEntrypoint: '@corvu-next/astrojs-solid-next/client.js',
		serverEntrypoint: '@corvu-next/astrojs-solid-next/server.js',
	};
}
