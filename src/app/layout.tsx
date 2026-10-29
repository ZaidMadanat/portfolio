import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
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
        {/* The frame lives in (site)/layout.tsx and admin/layout.tsx. */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
