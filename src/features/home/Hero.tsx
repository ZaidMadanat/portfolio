import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Pill } from "@/components/ui/Pill";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="grid items-center gap-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-16"
    >
      <div className="flex flex-col items-start gap-6">
        <Pill tone="soft2" className="-rotate-2">
          Statistics · UC Berkeley
        </Pill>
        <h1
          id="hero-heading"
          className="font-display text-[clamp(3.25rem,8vw,6rem)] leading-[0.95] font-extrabold tracking-tight"
        >
          Hi, I&apos;m <span className="text-accent-ink">Zaid.</span>
        </h1>
        <p className="max-w-[34em] text-lg leading-relaxed text-muted sm:text-xl">
          A student at UC Berkeley studying Statistics, with a minor in Computer Science &amp;
          Philosophy. My focus is multimodal agents, reinforcement learning, transfer learning and
          philosophy in AI. I&apos;m connecting statistics and philosophy to push the boundaries of
          artificial intelligence.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/blog" variant="primary" className="lift">
            Read the blog
          </ButtonLink>
          <ButtonLink href="/reviews" variant="outline">
            What I&apos;m watching &amp; eating
          </ButtonLink>
        </div>
      </div>

      {/* The accent block sits inside the padding, so it never causes horizontal scroll. */}
      <div className="relative mx-auto w-full max-w-90 pr-4 pb-4 sm:pr-5 sm:pb-5">
        <div aria-hidden="true" className="absolute top-4 right-0 bottom-0 left-4 rounded-[36px] bg-accent sm:top-5 sm:left-5" />
        {/* 720 px WebP: twice the 360 px box. The 800 px JPEG stays for Open Graph. */}
        <Image
          src="/images/zaid-720.webp"
          alt="Zaid Madanat"
          width={720}
          height={900}
          unoptimized
          preload
          sizes="360px"
          className="relative block aspect-4/5 w-full rounded-[36px] border-3 border-ink object-cover object-top"
        />
      </div>
    </section>
  );
}
