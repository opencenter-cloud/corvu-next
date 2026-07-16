import type { AstroIntegration, AstroRenderer } from 'astro';
import type { PluginOption, Plugin } from 'vite';
import solid, { type Options as ViteSolidPluginOptions } from 'vite-plugin-solid';
import { getContainerRenderer as getContainerRendererImpl } from './container-renderer.js';

export function getContainerRenderer(): AstroRenderer {
	return getContainerRendererImpl();
}

export interface Options extends Pick<ViteSolidPluginOptions, 'include' | 'exclude'> {}

export default function (options: Options = {}): AstroIntegration {
	return {
		name: '@corvu-next/astrojs-solid-next',
		hooks: {
			'astro:config:setup': async ({
				addRenderer,
				updateConfig,
			}) => {
				addRenderer(getContainerRendererImpl());
				updateConfig({
					vite: getViteConfiguration(options),
				});
			},
			'astro:config:done': ({ logger, config }) => {
				const knownJsxRenderers = ['@astrojs/react', '@astrojs/preact', '@corvu-next/astrojs-solid-next'];
				const enabledKnownJsxRenderers = config.integrations.filter((renderer) =>
					knownJsxRenderers.includes(renderer.name),
				);

				if (enabledKnownJsxRenderers.length > 1 && !options.include && !options.exclude) {
					logger.warn(
						'More than one JSX renderer is enabled. This will lead to unexpected behavior unless you set the `include` or `exclude` option.',
					);
				}
			},
		},
	};
}

function getViteConfiguration({ include, exclude }: Options) {
	const plugins: PluginOption[] = [
		solid({ include, exclude, ssr: true }),
		configEnvironmentPlugin(),
	];

	return { plugins };
}

function configEnvironmentPlugin(): Plugin {
	return {
		name: '@corvu-next/astrojs-solid-next:config-environment',
		configEnvironment(environmentName) {
			return {
				optimizeDeps: {
					include: environmentName === 'client' ? ['@corvu-next/astrojs-solid-next/client.js'] : [],
					exclude: ['@corvu-next/astrojs-solid-next/server.js'],
				},
			};
		},
	};
}
