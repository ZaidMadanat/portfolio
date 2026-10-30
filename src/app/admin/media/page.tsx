import type { Metadata } from "next";
import { MediaLibrary } from "@/features/admin/media/MediaLibrary";
import { getMediaLibrary } from "@/lib/admin/media-library";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "Photo library" };

// The photo library (spec §7). The layout guards it too; this page reads
// admin data, so it checks the session itself as well.
export default async function MediaPage() {
  await requireAdmin();
  const items = await getMediaLibrary();
  return <MediaLibrary items={items} />;
}
