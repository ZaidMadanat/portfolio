"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { isSubscribeState, SUBSCRIBE_STATES } from "./subscribe-states";

// /subscribed is static (spec §3.1): `?state=` is read in the browser. The
// prerendered HTML (and a no-JS visit) shows the neutral fallback.
export function SubscribedStatus() {
  return (
    <Suspense fallback={<Status title="Email updates" body="Get new posts by email, or follow the RSS feed." />}>
      <FromSearchParams />
    </Suspense>
  );
}

function FromSearchParams() {
  const state = useSearchParams().get("state");
  if (!isSubscribeState(state)) {
    return <Status title="Email updates" body="Get new posts by email, or follow the RSS feed." />;
  }
  const { title, body } = SUBSCRIBE_STATES[state];
  return <Status title={title} body={body} />;
}

function Status({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-5">
      <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="max-w-prose text-lg leading-relaxed text-muted">{body}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/blog" variant="primary">
          Back to the blog
        </ButtonLink>
        <a
          href="/rss.xml"
          className="inline-flex min-h-11 items-center font-semibold text-accent-ink underline underline-offset-2"
        >
          RSS feed
        </a>
      </div>
    </div>
  );
}
