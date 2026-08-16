import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

/**
 * ── 2026-08 · THE SHARE CARD WAS A 404 ────────────────────────────────────
 * `images: [{ url: "/og-image.png" }]` pointed at a file that does not exist —
 * this project has no `public/` folder at all. Every shared link rendered
 * without a preview on WhatsApp, iMessage, Twitter and Facebook.
 *
 * The explicit image entries are removed. Next.js now picks up
 * `app/opengraph-image.tsx` and `app/icon.tsx` by filename and fills in both
 * `openGraph.images` and `twitter.images` itself, with a hashed URL and the
 * right dimensions. Do not re-add a hardcoded path here — it overrides the
 * generated one and puts the 404 back.
 *
 * metadataBase is what makes the generated image resolve to an absolute URL,
 * which the crawlers require. Set NEXT_PUBLIC_SITE_URL in Vercel; the fallback
 * is the live deployment.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://roast-me-wheat.vercel.app";

export const metadata: Metadata = {
  title: "Roast-Me | Cosmic Damage Reports",
  description:
    "Enter your birth details. Receive a personalised Vedic roast. Share it with enemies.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Roast-Me",
    description: "The cosmos has seen everything. And it has notes.",
    url: SITE_URL,
    siteName: "Roast-Me",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roast-Me",
    description: "The cosmos has seen everything. And it has notes.",
    creator: "@yashrajv",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Anti-FOUC: apply saved theme class before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('rm-theme') === 'light')
              document.documentElement.classList.add('light-theme');
          } catch(e) {}
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Space+Grotesk:wght@400;500;600;700&family=Inconsolata:wght@300;400;500&family=Syne:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
