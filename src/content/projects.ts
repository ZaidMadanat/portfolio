// Portfolio projects on the home page (spec §6.1). Hard-coded, not admin-editable.

export type Project = {
  slug: string;
  name: string;
  blurb: string;
  tags: string[];
  /** Omitted for Ajir, which has no public link. */
  href?: string;
  featured?: boolean;
  pills?: string[];
};

export const PROJECTS: Project[] = [
  {
    slug: "ajir",
    name: "Ajir",
    blurb:
      "A neighborhood rental marketplace: rent anything from your neighbors, earn from gear sitting idle. Identity-verified renters, held payments and refundable deposits, automatic payouts.",
    tags: [],
    featured: true,
    pills: ["Featured", "Pre-seed · private beta"],
  },
  {
    slug: "plateful",
    name: "Plateful",
    blurb:
      "An iOS app that plans meals around your calories and macros with Claude, a LiveKit voice assistant that talks you through recipes, and an agent that turns them into a Kroger cart.",
    tags: ["Swift", "LiveKit", "FastAPI", "ChromaDB", "Claude API"],
    href: "https://github.com/ZaidMadanat/Plateful",
  },
  {
    slug: "alfworld-green-white-agent",
    name: "Alfworld Green & White Agent",
    blurb:
      "A green agent that scores other agents in the Alfred benchmark on how much noise they leave in the environment, plus a tuned white agent. Both registered through AgentBeats.",
    tags: ["PyTorch", "Reinforcement Learning", "Agents", "Docker"],
    href: "https://github.com/ZaidMadanat/alfworld-greenagent",
  },
  {
    slug: "berkeley-mobile",
    name: "Berkeley Mobile",
    blurb:
      "iOS developer on the official Berkeley Mobile app. Built the Tahoe integration and guides for students and visitors.",
    tags: ["Swift", "iOS", "UI/UX", "REST APIs"],
    href: "https://github.com/asuc-octo/berkeley-mobile-ios",
  },
];
