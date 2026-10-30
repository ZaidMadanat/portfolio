import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/site/ThemeProvider";
import { siteUrl } from "@/lib/site";
import { OG_DEFAULTS, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-metadata";
import "./globals.css";
import "../styles/motion.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Icons come from the file conventions in this folder: icon.svg (the ZM mark),
// favicon.ico and apple-icon.png (made from it by scripts/icons.mjs).
export const metadata: Metadata = {
  // NEXT_PUBLIC_SITE_URL, else https://zaidmadanat.com.
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // No og:url here: every page would inherit the home URL.
  openGraph: { ...OG_DEFAULTS, type: "website" },
  twitter: { card: "summary" },
  // Feed discovery (spec §6.9).
  alternates: { types: { "application/rss+xml": [{ url: "/rss.xml", title: "Zaid Madanat" }] } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-motion="on"
      suppressHydrationWarning
      className={`${bricolage.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* The frame lives in (site)/layout.tsx and admin/layout.tsx. */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
