import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { ThemeProvider } from "@/components/site/ThemeProvider";
import { siteUrl } from "@/lib/site";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Zaid Madanat",
    template: "%s · Zaid Madanat",
  },
  description:
    "Zaid Madanat studies Statistics at UC Berkeley. Projects, a blog, and what he's watching, eating and listening to.",
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
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only rounded-full border-2 border-ink bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
