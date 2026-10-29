export type SocialIcon = "github" | "linkedin" | "email" | "letterboxd" | "strava";

export type SocialLink = {
  label: string;
  href: string;
  icon: SocialIcon;
  /** Shown next to the label on the contact page. */
  handle: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/ZaidMadanat", icon: "github", handle: "@ZaidMadanat" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/zaid-madanat-8257001b3/",
    icon: "linkedin",
    handle: "zaid-madanat",
  },
  {
    label: "Email",
    href: "mailto:zaidsmadanat@gmail.com",
    icon: "email",
    handle: "zaidsmadanat@gmail.com",
  },
  {
    label: "Letterboxd",
    href: "https://letterboxd.com/itsMaday/",
    icon: "letterboxd",
    handle: "@itsMaday",
  },
  {
    label: "Strava",
    href: process.env.NEXT_PUBLIC_STRAVA_URL || "https://www.strava.com",
    icon: "strava",
    handle: "Profile",
  },
];
