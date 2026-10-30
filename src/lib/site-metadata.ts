import type { Metadata } from "next";

// Shared head metadata. The root layout uses it, and a page that sets its own
// `openGraph` spreads OG_DEFAULTS in, because Next replaces a parent's
// openGraph object instead of merging it.

export const SITE_NAME = "Zaid Madanat";

/** The first two sentences of the home bio (spec §6.1). */
export const SITE_DESCRIPTION =
  "A student at UC Berkeley studying Statistics, with a minor in Computer Science & Philosophy. My focus is multimodal agents, reinforcement learning, transfer learning and philosophy in AI.";

/** The home photo (public/images/zaid.jpg); absolute through metadataBase. */
export const OG_IMAGE = { url: "/images/zaid.jpg", width: 800, height: 1000, alt: "Zaid Madanat" } as const;

export const OG_DEFAULTS = {
  siteName: SITE_NAME,
  locale: "en_US",
  images: [OG_IMAGE],
} satisfies NonNullable<Metadata["openGraph"]>;
