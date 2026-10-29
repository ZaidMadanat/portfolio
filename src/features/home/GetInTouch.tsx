import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";

export function GetInTouch() {
  return (
    <section
      aria-labelledby="touch-heading"
      className="flex flex-col gap-8 rounded-[36px] bg-ink px-7 py-10 text-bg sm:px-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 id="touch-heading" className="font-display text-4xl leading-[1.05] font-extrabold sm:text-[2.75rem]">
          Got a project, a question, or a film rec?
        </h2>
        <p className="text-lg leading-relaxed">
          I&apos;m always open to discussing projects, opportunities, or just chatting about AI,
          statistics, and philosophy.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 lg:shrink-0">
        <ButtonLink href="mailto:zaidsmadanat@gmail.com" variant="primary" className="lift">
          Email me
        </ButtonLink>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-bg px-5 py-2.5 font-bold text-bg"
        >
          Book a call
        </Link>
      </div>
    </section>
  );
}
