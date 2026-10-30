import { escapeHtml } from "./templates";

// The pages behind the links in our emails (spec §9.4). GET only renders;
// the state changes on POST (decision "No state change on GET for email
// links"), so mail scanners that open links can't confirm or unsubscribe
// anyone. Plain HTML with no JS: the button is a form POST. Styled by
// public/email/link-page.css (Citrus Pop tokens, kept in step by a test).

type Action = { label: string; action: string };

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  // The URL carries a token: never send it on in a Referer.
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

export function linkPage(
  { title, body, button }: { title: string; body: string; button?: Action },
  status = 200,
): Response {
  const form = button
    ? [
        `<form method="post" action="${escapeHtml(button.action)}">`,
        `<button type="submit">${escapeHtml(button.label)}</button>`,
        "</form>",
        '<a class="secondary" href="/blog">Back to the blog</a>',
      ].join("\n")
    : '<a class="button" href="/blog">Back to the blog</a>';
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(title)} · Zaid Madanat</title>`,
    '<link rel="stylesheet" href="/email/link-page.css">',
    "</head>",
    "<body>",
    "<main>",
    '<a class="mark" href="/">ZM</a>',
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(body)}</p>`,
    form,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return new Response(html, { status, headers: HEADERS });
}

/** The same page for every bad, unknown or out-of-date token: no detail about why. */
export function invalidLinkPage(): Response {
  return linkPage(
    { title: "That link didn't work.", body: "It may be out of date. You can sign up again from the blog." },
    400,
  );
}

/** A 303 to the static /subscribed page. */
export function toSubscribed(req: Request, state: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(`/subscribed?state=${state}`, req.url).toString(), "Cache-Control": "no-store" },
  });
}

/** The token from `?token=`, else from a form body field `token`. */
export async function readToken(req: Request, form?: FormData | null): Promise<string> {
  const fromUrl = new URL(req.url).searchParams.get("token");
  if (fromUrl) return fromUrl;
  const fromBody = form?.get("token");
  return typeof fromBody === "string" ? fromBody : "";
}
