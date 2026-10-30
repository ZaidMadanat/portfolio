import { SiteChrome } from "@/components/site/SiteChrome";

// Public pages (spec §6). The route group only adds the site frame; URLs are unchanged.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteChrome>{children}</SiteChrome>;
}
