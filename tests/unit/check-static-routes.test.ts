import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkStaticRoutes, checkTracedFiles, PUBLIC_ROUTES, privateTraced } from "../../scripts/check-static-routes.mjs";

const page = { routeType: "page", compute: "static" };

/** Manifests for a build where every public route is static. */
function goodBuild() {
  const appPaths: Record<string, string> = {};
  const routes: Record<string, unknown> = {};
  for (const route of PUBLIC_ROUTES) {
    appPaths[`/(site)${route === "/" ? "" : route}/page`] = route;
    if (!route.includes("[")) routes[route] = page;
  }
  routes["/blog/hello"] = page;
  appPaths["/admin/page"] = "/admin";
  return {
    appPaths,
    prerender: { routes, dynamicRoutes: { "/blog/[slug]": { routeType: "page", fallback: null } } },
  };
}

describe("checkStaticRoutes", () => {
  it("covers the public routes from Global Constraints", () => {
    expect(PUBLIC_ROUTES).toEqual([
      "/",
      "/blog",
      "/blog/[slug]",
      "/reviews",
      "/reviews/food",
      "/reviews/film",
      "/reviews/music",
      "/contact",
      "/rss.xml",
    ]);
  });

  it("passes when every public route is prerendered or ISR", () => {
    expect(checkStaticRoutes(goodBuild())).toEqual([]);
  });

  it("fails a public page that renders on demand", () => {
    const build = goodBuild();
    delete (build.prerender.routes as Record<string, unknown>)["/reviews/food"];
    expect(checkStaticRoutes(build)).toEqual(["/reviews/food is dynamic (ƒ): it is not prerendered"]);
  });

  it("fails a dynamic segment with no ISR entry", () => {
    const build = goodBuild();
    build.prerender.dynamicRoutes = {} as typeof build.prerender.dynamicRoutes;
    expect(checkStaticRoutes(build)).toEqual(["/blog/[slug] is dynamic (ƒ): it has no prerender (ISR) entry"]);
  });

  it("fails a public route missing from the build", () => {
    const build = goodBuild();
    delete build.appPaths["/(site)/contact/page"];
    expect(checkStaticRoutes(build)).toEqual(["/contact is missing from the build"]);
  });
});

describe("privateTraced", () => {
  it("flags the private planning files and env files, nothing else", () => {
    expect(
      privateTraced([
        "docs/superpowers/plans/x.md",
        ".claude/agents/site-frontend.md",
        "agent-coordination.md",
        ".env",
        ".env.local",
        "src/.env.production",
        "node_modules/next/dist/server/next.js",
        "src/lib/env.ts",
        "public/images/zaid.jpg",
        "documents/a.md",
      ]),
    ).toEqual(["docs/superpowers/plans/x.md", ".claude/agents/site-frontend.md", "agent-coordination.md", ".env", ".env.local", "src/.env.production"]);
  });
});

describe("checkTracedFiles", () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("reads every .nft.json under the build and names the trace that pulls in a private file", () => {
    root = mkdtempSync(join(tmpdir(), "nft-"));
    const dist = join(root, ".next");
    mkdirSync(join(dist, "server/app"), { recursive: true });
    writeFileSync(join(dist, "next-server.js.nft.json"), JSON.stringify({ version: 1, files: ["../node_modules/next/x.js"] }));
    writeFileSync(
      join(dist, "server/app/page.js.nft.json"),
      JSON.stringify({ version: 1, files: ["../../../src/lib/env.ts", "../../../docs/notes.md", "../../../.env.local"] }),
    );
    const { count, problems } = checkTracedFiles(dist, root);
    expect(count).toBe(2);
    expect(problems).toEqual([
      "server/app/page.js.nft.json traces docs/notes.md",
      "server/app/page.js.nft.json traces .env.local",
    ]);
  });
});
