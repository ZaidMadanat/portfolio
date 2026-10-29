import { SOCIAL_LINKS } from "@/components/site/social-links";
import { GetInTouch } from "@/features/home/GetInTouch";
import { Hero } from "@/features/home/Hero";
import { Lately } from "@/features/home/Lately";
import { OffTheKeyboard } from "@/features/home/OffTheKeyboard";
import { Projects } from "@/features/home/Projects";
import { getHomeData } from "@/lib/queries/home";

// Static; rebuilt only when the `home` tag is revalidated (spec §7.3).
export const revalidate = false;

const STRAVA_URL = SOCIAL_LINKS.find((l) => l.icon === "strava")!.href;

export default async function HomePage() {
  const { strava, lastFilm, topAlbum, latestPost } = await getHomeData();
  return (
    <div className="flex flex-col gap-20 sm:gap-24">
      <Hero />
      <Projects />
      <OffTheKeyboard summary={strava} profileUrl={STRAVA_URL} />
      <Lately lastFilm={lastFilm} topAlbum={topAlbum} latestPost={latestPost} />
      <GetInTouch />
    </div>
  );
}
