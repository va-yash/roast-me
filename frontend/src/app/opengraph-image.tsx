/**
 * opengraph-image.tsx — the share card for Roast-Me
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * layout.tsx has always pointed OpenGraph and Twitter at "/og-image.png".
 * There is no `public/` folder in this project and there never was, so that
 * URL has been a 404 since the first deploy.
 *
 * The consequence is bigger than a missing picture. Roast-Me has exactly one
 * growth mechanism — somebody shares their roast — and a link with no preview
 * image renders on WhatsApp, iMessage, Twitter and Facebook as a bare grey
 * row. It looks broken, so it does not get clicked, so it does not get shared
 * again. The loop the whole product depends on was cut at the first step.
 *
 * Generating it here instead of shipping a binary PNG means:
 *   • nothing to commit, nothing to keep in sync with the design
 *   • Next.js renders it at build time and serves it with a hashed URL
 *   • the copy lives in code and can be edited like any other string
 *
 * Next.js picks this file up automatically by name. The explicit
 * `openGraph.images` / `twitter.images` entries in layout.tsx should be
 * REMOVED so this one wins — see the note there.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Roast-Me — the cosmos has seen everything, and it has notes'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060A14',
          // A single radial wash, matching the app's own hero background.
          backgroundImage:
            'radial-gradient(ellipse 70% 70% at 50% 40%, rgba(30,58,140,0.35) 0%, transparent 70%)',
          padding: '0 90px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Top hairline */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              'linear-gradient(90deg, transparent, #C08B2F 35%, #DEB86A 65%, transparent)',
          }}
        />

        <div
          style={{
            fontSize: 22,
            letterSpacing: 14,
            color: '#C08B2F',
            fontWeight: 700,
            marginBottom: 42,
            display: 'flex',
          }}
        >
          ROAST-ME
        </div>

        <div
          style={{
            fontSize: 74,
            lineHeight: 1.12,
            color: '#E2E8F4',
            fontWeight: 600,
            letterSpacing: -1,
            display: 'flex',
          }}
        >
          The cosmos has seen everything.
        </div>

        <div
          style={{
            fontSize: 60,
            lineHeight: 1.2,
            color: '#DEB86A',
            fontStyle: 'italic',
            marginTop: 14,
            display: 'flex',
          }}
        >
          And it has notes.
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: 27,
            color: '#8494AC',
            display: 'flex',
          }}
        >
          Your birth chart, read back to you. Personally.
        </div>
      </div>
    ),
    { ...size }
  )
}
