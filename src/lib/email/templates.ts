import { siteUrl } from "@/lib/site";
import type { Msg } from "./send";

// Plain HTML emails (spec §9.4). Every message carries the one-click
// unsubscribe headers (RFC 8058), confirmations included.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const confirmUrl = (token: string) => `${siteUrl()}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
export const unsubscribeUrl = (token: string) => `${siteUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
export const postUrl = (slug: string) => `${siteUrl()}/blog/${encodeURIComponent(slug)}`;

export function unsubscribeHeaders(unsubscribeToken: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(unsubscribeToken)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function layout(body: string, unsubscribeHref: string): string {
  return [
    "<!doctype html>",
    '<html lang="en"><body style="margin:0;padding:24px;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.5">',
    '<div style="max-width:560px;margin:0 auto">',
    body,
    `<p style="margin-top:32px;font-size:13px">You're getting this because you subscribed at zaidmadanat.com. <a href="${escapeHtml(unsubscribeHref)}">Unsubscribe</a>.</p>`,
    "</div></body></html>",
  ].join("\n");
}

type Recipient = { email: string; confirmToken?: string; unsubscribeToken: string };

export function confirmationEmail(sub: Recipient & { confirmToken: string }): Msg {
  const confirm = confirmUrl(sub.confirmToken);
  const unsub = unsubscribeUrl(sub.unsubscribeToken);
  return {
    to: sub.email,
    subject: "Confirm your subscription to Zaid Madanat's blog",
    html: layout(
      [
        "<p>Thanks for signing up. Confirm your email and you'll get new posts as they come out.</p>",
        `<p><a href="${escapeHtml(confirm)}" style="font-weight:700">Confirm my subscription</a></p>`,
        "<p>If you didn't ask for this, ignore this email and nothing happens.</p>",
      ].join("\n"),
      unsub,
    ),
    text: [
      "Thanks for signing up. Confirm your email and you'll get new posts as they come out:",
      confirm,
      "",
      "If you didn't ask for this, ignore this email and nothing happens.",
      "",
      `Unsubscribe: ${unsub}`,
    ].join("\n"),
    headers: unsubscribeHeaders(sub.unsubscribeToken),
  };
}

export type PostForEmail = { title: string; excerpt: string; slug: string };

export function newPostEmail(sub: Recipient, post: PostForEmail): Msg {
  const read = postUrl(post.slug);
  const unsub = unsubscribeUrl(sub.unsubscribeToken);
  return {
    to: sub.email,
    subject: post.title,
    html: layout(
      [
        `<h1 style="font-size:24px;line-height:1.2;margin:0 0 12px">${escapeHtml(post.title)}</h1>`,
        post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : "",
        `<p><a href="${escapeHtml(read)}" style="font-weight:700">Read it</a></p>`,
      ]
        .filter(Boolean)
        .join("\n"),
      unsub,
    ),
    text: [post.title, "", post.excerpt, "", `Read it: ${read}`, "", `Unsubscribe: ${unsub}`].join("\n"),
    headers: unsubscribeHeaders(sub.unsubscribeToken),
  };
}
