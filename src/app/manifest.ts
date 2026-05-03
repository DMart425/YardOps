import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YardOps',
    short_name: 'YardOps',
    description: 'Lawn job manager',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0c0c',
    theme_color: '#0c0c0c',
    orientation: 'portrait',
    icons: [
      { src: '/logo.png', sizes: 'any', type: 'image/png' },
    ],
  }
}
