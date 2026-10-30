import { SOCIAL_LINKS } from "./social-links";
import { SocialGlyph } from "./SocialGlyph";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-col-reverse items-center justify-between gap-4 border-t-2 border-line px-4 py-8 sm:flex-row sm:px-6">
      <p className="text-sm text-muted">
        © {year} Zaid Madanat · Berkeley, CA
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {SOCIAL_LINKS.map(({ label, href, icon }) => {
          const external = !href.startsWith("mailto:");
          return (
            <li key={label}>
              <a
                href={href}
                aria-label={label}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="lift inline-flex size-11 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink hover:bg-soft"
              >
                <SocialGlyph icon={icon} />
              </a>
            </li>
          );
        })}
      </ul>
    </footer>
  );
}
