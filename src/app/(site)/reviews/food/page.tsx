import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { FoodExplorer } from "@/features/food/FoodExplorer";
import { getPlaces } from "@/lib/queries/food";

export const metadata: Metadata = {
  title: "Food",
  description: "Places Zaid Madanat has eaten around the Bay Area, on a map, with what to order and a score out of 10.",
};

// Static; rebuilt only when the `reviews` tag is revalidated (spec §7.3).
// Filters run in the browser (FoodExplorer), so the server never reads the query.
export const revalidate = false;

export default async function FoodPage() {
  const places = await getPlaces();
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link href="/reviews" className="inline-flex min-h-11 items-center self-start font-semibold text-muted hover:text-ink">
          ← Reviews
        </Link>
        <h1 className="font-display text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight">Food</h1>
        <p className="max-w-[34em] text-lg leading-relaxed text-pretty text-muted sm:text-xl">
          Where I&apos;ve eaten around the Bay Area, what to order, and a score out of 10.
        </p>
      </header>
      {places.length ? <FoodExplorer places={places} /> : <EmptyState title="No places yet." />}
    </div>
  );
}
