// Copy for every outcome of the subscribe flow. The banner shows `banner`
// inline after a fetch; /subscribed (no-JS form posts and email links) shows
// `title` + `body` for `?state=`. State names match the API (api/subscribe,
// api/subscribe/confirm, api/unsubscribe).

export type SubscribeState =
  | "pending"
  | "already"
  | "confirmed"
  | "unsubscribed"
  | "invalid-email"
  | "invalid-link"
  | "busy"
  | "error";

type Copy = { title: string; body: string; banner: string; ok: boolean };

export const SUBSCRIBE_STATES: Record<SubscribeState, Copy> = {
  pending: {
    title: "Almost there.",
    body: "Check your inbox for a confirmation link. Your subscription starts once you click it.",
    banner: "Almost there. Check your inbox for a confirmation link.",
    ok: true,
  },
  already: {
    title: "You're already subscribed.",
    body: "New posts will keep arriving by email.",
    banner: "You're already subscribed. New posts will keep arriving by email.",
    ok: true,
  },
  confirmed: {
    title: "You're in.",
    body: "New posts will land in your inbox. Every email has a link to unsubscribe.",
    banner: "You're in.",
    ok: true,
  },
  unsubscribed: {
    title: "You're unsubscribed.",
    body: "You won't get any more emails. The RSS feed is still there if you want it.",
    banner: "You're unsubscribed.",
    ok: true,
  },
  "invalid-email": {
    title: "That email address doesn't look right.",
    body: "Go back to the blog and try again.",
    banner: "That email address doesn't look right.",
    ok: false,
  },
  "invalid-link": {
    title: "That link didn't work.",
    body: "It may be out of date. You can sign up again from the blog.",
    banner: "That link didn't work.",
    ok: false,
  },
  busy: {
    title: "Too many tries.",
    body: "Wait a few minutes and try again.",
    banner: "Too many tries. Wait a few minutes and try again.",
    ok: false,
  },
  error: {
    title: "Something went wrong.",
    body: "Please try again later.",
    banner: "Something went wrong. Please try again later.",
    ok: false,
  },
};

export function isSubscribeState(value: string | null | undefined): value is SubscribeState {
  return typeof value === "string" && Object.hasOwn(SUBSCRIBE_STATES, value);
}
