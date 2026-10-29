import type { Metadata } from "next";
import { SubscribedStatus } from "@/features/blog/SubscribedStatus";

export const metadata: Metadata = {
  title: "Email updates",
  description: "Subscription status for new-post emails.",
  robots: { index: false },
};

// Static. The subscribe, confirm and unsubscribe routes redirect here with
// ?state=, which SubscribedStatus reads on the client.
export const revalidate = false;

export default function SubscribedPage() {
  return <SubscribedStatus />;
}
