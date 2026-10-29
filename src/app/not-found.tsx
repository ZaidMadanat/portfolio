import { SiteChrome } from "@/components/site/SiteChrome";
import { ButtonLink } from "@/components/ui/ButtonLink";

// Unknown URLs and notFound() render outside the (site) group's layout, so this
// page brings the site frame itself.
export default function NotFound() {
  return (
    <SiteChrome>
      <section className="flex flex-col items-start gap-4 py-10">
        <h1 className="font-display text-4xl font-extrabold">Page not found</h1>
        <p className="text-muted">That page doesn&apos;t exist, or it moved.</p>
        <ButtonLink href="/" variant="outline">
          Back home
        </ButtonLink>
      </section>
    </SiteChrome>
  );
}
