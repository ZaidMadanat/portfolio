import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

// The public site's frame: skip link, header, <main id="main">, footer. Used by
// the (site) route group's layout and by the root not-found page. The admin
// has its own frame (src/app/admin/layout.tsx).
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
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
    </>
  );
}
