import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Swapped away from the serif (Fraunces) entirely per feedback — it read
// as dated rather than premium. Space Grotesk is a sharp, geometric
// display sans with the kind of confident, modern feel the reference
// mockups actually had, used for major headings and the wordmark.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Madras Menu Studio",
  description: "Menu planning for Madras Catering",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="site-accent-bar" />
        <header className="site-header">
          <Link href="/events" className="site-brand">
            <span className="site-brand-mark">✺</span> Madras Menu Studio
          </Link>
          <span className="site-tagline">Menu planning for Madras Catering</span>
          {/* Visual placeholders only — no auth wired up yet (deliberate,
              see the plan doc: real Auth.js login is its own later session). */}
          <div className="site-auth">
            <button className="btn-outline" type="button">Create Account</button>
            <button type="button">Sign In</button>
          </div>
        </header>
        <div className="site-body">{children}</div>
      </body>
    </html>
  );
}
