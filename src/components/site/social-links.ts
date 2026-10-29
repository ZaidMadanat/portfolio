export type SocialIcon = "github" | "linkedin" | "email" | "letterboxd" | "strava";

export type SocialLink = {
  label: string;
  href: string;
  icon: SocialIcon;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/ZaidMadanat", icon: "github" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/zaid-madanat-8257001b3/",
    icon: "linkedin",
  },
  { label: "Email", href: "mailto:zaidsmadanat@gmail.com", icon: "email" },
  {
    label: "Letterboxd",
    href: "https://letterboxd.com/itsMaday/",
    icon: "letterboxd",
  },
  {
    label: "Strava",
    href: process.env.NEXT_PUBLIC_STRAVA_URL ?? "https://www.strava.com",
    icon: "strava",
  },
];
