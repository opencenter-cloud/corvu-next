import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import solid from '@corvu-next/astrojs-solid-next'
import tailwind from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  integrations: [
    mdx(),
    solid(),
  ],
  prefetch: {
    prefetchAll: true,
  },
  redirects: {
    '/docs/usage/': {
      status: 307,
      destination: '/docs/state/',
    },
    '/docs/polymorphic/': {
      status: 307,
      destination: '/docs/dynamic-components/',
    },
    '/docs/polymorphism/': {
      status: 307,
      destination: '/docs/dynamic-components/',
    },
    '/docs/primitives/': {
      status: 307,
      destination: '/docs/overview/',
    },
    '/docs/utilities/': {
      status: 307,
      destination: '/docs/overview/',
    },
  },
  markdown: {
    syntaxHighlight: false,
  },
  site: 'http://localhost:4321',
  trailingSlash: 'always',
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwind()],
  },
})
