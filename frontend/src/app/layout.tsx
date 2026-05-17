import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Roast-Me — Cosmic Damage Reports",
  description: "Enter your birth details. Receive a personalised Vedic roast. Share it with enemies.",
  metadataBase: new URL("https://roast-me.me"),
  openGraph: {
    title: "Roast-Me",
    description: "The cosmos have seen everything. And they have notes.",
    url: "https://roast-me.me",
    siteName: "Roast-Me",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Roast-Me — Cosmic Damage Reports" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roast-Me",
    description: "The cosmos have seen everything. And they have notes.",
    images: ["/og-image.png"],
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
