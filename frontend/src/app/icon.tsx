/**
 * icon.tsx — favicon for Roast-Me
 *
 * There is no `public/` folder in this project, so the site has been serving
 * the browser's default blank-page icon since launch. A tab with no icon is a
 * small thing on its own and a large one in aggregate: it is what a bookmark,
 * a pinned tab and a shared-link row all fall back to.
 *
 * Generated rather than committed for the same reason as opengraph-image.tsx —
 * nothing to keep in sync, and the colours come from the app's own palette.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060A14',
          color: '#DEB86A',
          fontSize: 24,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        ✦
      </div>
    ),
    { ...size }
  )
}
