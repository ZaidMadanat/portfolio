import type { Metadata } from "next";
import { SOCIAL_LINKS } from "@/components/site/social-links";
import { SocialGlyph } from "@/components/site/SocialGlyph";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { CalEmbed } from "@/features/contact/CalEmbed";
import { calLinkFromEnv } from "@/features/contact/cal-link";

export const metadata: Metadata = {
  title: "Contact",
  description: "Email Zaid Madanat, find him elsewhere, or book a 30-minute chat.",
};

const EMAIL = "zaidsmadanat@gmail.com";
const PROFILES = SOCIAL_LINKS.filter((link) => link.icon !== "email");
// Inlined at build time, so the page stays static either way.
const CAL_LINK = calLinkFromEnv(process.env.NEXT_PUBLIC_CALCOM_LINK);

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-end">
        <div className="flex flex-col items-start gap-5">
          <h1 className="font-display text-[clamp(3.25rem,7vw,5.25rem)] leading-[0.95] font-extrabold tracking-tight">
            Say hi.
          </h1>
          <p className="max-w-prose text-lg leading-relaxed text-muted sm:text-xl">
            I&apos;m always open to discussing projects, opportunities, or just chatting about
            AI, statistics, and philosophy. Email is fastest, or grab 30 minutes on my calendar.
          </p>
          <ButtonLink
            href={`mailto:${EMAIL}`}
            variant="primary"
            className="lift max-w-full -rotate-1 px-6 py-4 font-display text-xl font-extrabold break-all sm:text-2xl"
          >
            {EMAIL}
          </ButtonLink>
        </div>

        <ul aria-label="Social profiles" className="flex flex-col gap-2.5">
          {PROFILES.map(({ label, href, icon, handle }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 items-center gap-3.5 rounded-2xl border-2 border-line bg-surface px-4 py-3 hover:border-ink"
              >
                <SocialGlyph icon={icon} className="size-5.5 shrink-0" />
                <span className="font-bold">{label}</span>{" "}
                <span className="ml-auto truncate text-muted">{handle}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Card as="section" aria-labelledby="book-heading" className="flex flex-col gap-5 p-5 sm:p-7">
        <h2 id="book-heading" className="font-display text-2xl font-extrabold sm:text-3xl">
          Book a 30-minute chat
        </h2>
        {CAL_LINK ? (
          <CalEmbed calLink={CAL_LINK} />
        ) : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg text-muted">Calendar coming soon. Email me to find a time.</p>
            <ButtonLink href={`mailto:${EMAIL}`} variant="outline" className="shrink-0">
              Email me
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
