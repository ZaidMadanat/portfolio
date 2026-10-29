import { describe, expect, it } from "vitest";
import { extractMediaIds, withMediaAlt } from "@/lib/blocks/media-refs";
import { plainText, renderPostHtml, sanitizePostHtml } from "@/lib/blocks/render";
import { schema } from "@/lib/blocks/schema";

const blob = "https://x.public.blob.vercel-storage.com";

describe("schema", () => {
  it("has the default blocks plus math and callout", () => {
    const types = Object.keys(schema.blockSpecs);
    expect(types).toEqual(
      expect.arrayContaining(["paragraph", "heading", "image", "math", "callout"]),
    );
    expect(schema.blockSpecs.math.config.propSchema.latex.default).toBe("");
    expect(schema.blockSpecs.callout.config.content).toBe("inline");
    expect(schema.blockSpecs.callout.config.propSchema.variant.values).toEqual([
      "tip",
      "warning",
    ]);
  });
});

describe("renderPostHtml", () => {
  it("renders math blocks with KaTeX inside div.math", async () => {
    const html = await renderPostHtml([
      { type: "math", props: { latex: "z = \\frac{x}{y}" } },
    ]);
    expect(html).toContain('class="math"');
    expect(html).toContain('class="katex"');
    // KaTeX MathML output survives sanitising.
    expect(html).toContain("<math");
    expect(html).toContain("mfrac");
  });

  it("keeps KaTeX layout styles and SVG (sqrt) after sanitising", async () => {
    const html = await renderPostHtml([{ type: "math", props: { latex: "\\sqrt{2}" } }]);
    expect(html).toMatch(/style="height:[\d.]+em/);
    expect(html).toContain("viewBox=");
    expect(html).toContain("<path d=");
  });

  it("renders toggle blocks without editor chrome", async () => {
    const html = await renderPostHtml([
      { type: "toggleListItem", content: "Open me", children: [{ type: "paragraph", content: "inside" }] },
    ]);
    expect(html).toContain("Open me");
    expect(html).toContain("inside");
    expect(html).not.toContain("<button");
  });

  it("doesn't throw on invalid LaTeX", async () => {
    const html = await renderPostHtml([{ type: "math", props: { latex: "\\frac{" } }]);
    expect(html).toContain('class="math"');
  });

  it("renders a warning callout as an aside with its rich text", async () => {
    const html = await renderPostHtml([
      {
        type: "callout",
        props: { variant: "warning" },
        content: [{ type: "text", text: "Careful", styles: { bold: true } }],
      },
    ]);
    expect(html).toContain('<aside class="callout callout-warning">');
    expect(html).toContain("<strong>Careful</strong>");
  });

  it("defaults the callout variant to tip", async () => {
    const html = await renderPostHtml([{ type: "callout", content: "Hint" }]);
    expect(html).toContain('<aside class="callout callout-tip">');
  });

  it("strips script tags and event handlers from paragraphs", async () => {
    const html = await renderPostHtml([
      { type: "paragraph", content: "Hello <script>alert(1)</script>" },
      {
        type: "image",
        props: { url: `${blob}/media/abc/960.webp" onerror="alert(1)`, caption: "Cap" },
      },
    ]);
    expect(html).not.toContain("<script");
    // Only as escaped text inside src, never as a real attribute.
    expect(html).not.toMatch(/\son\w+\s*=\s*["']/i);
    expect(html).toContain("Hello");
  });

  it("sanitizePostHtml drops handlers, iframes and styles outside KaTeX", () => {
    const out = sanitizePostHtml(
      '<p onclick="x()" style="color:red">a</p><img src="https://a/b.webp" onerror="x()"><iframe src="https://e"></iframe><figure style="width:500px"></figure>',
    );
    expect(out).toBe('<p>a</p><img src="https://a/b.webp" /><figure></figure>');
  });

  it("strips javascript: links", async () => {
    const html = await renderPostHtml([
      {
        type: "paragraph",
        content: [
          { type: "link", href: "javascript:alert(1)", content: "click" },
        ],
      },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("keeps images, headings and code blocks", async () => {
    const html = await renderPostHtml([
      { type: "heading", props: { level: 2 }, content: "Title" },
      { type: "image", props: { url: `${blob}/media/abc/960.webp`, caption: "A cap" } },
      { type: "codeBlock", props: { language: "ts" }, content: "const a = 1;" },
    ]);
    expect(html).toContain("<h2");
    expect(html).toContain(`src="${blob}/media/abc/960.webp"`);
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("const a = 1;");
  });

  it("renders an empty document to an empty-ish string", async () => {
    await expect(renderPostHtml([])).resolves.toBeTypeOf("string");
  });
});

describe("extractMediaIds", () => {
  it("returns unique media ids from image block urls, in order", () => {
    expect(
      extractMediaIds([
        { type: "image", props: { url: `${blob}/media/abc/960.webp` } },
        { type: "paragraph", content: "x" },
        { type: "image", props: { url: `${blob}/media/def/480.webp` } },
        { type: "image", props: { url: `${blob}/media/abc/2400.webp` } },
      ]),
    ).toEqual(["abc", "def"]);
  });

  it("finds images nested in children and ignores non-media urls", () => {
    expect(
      extractMediaIds([
        {
          type: "paragraph",
          children: [{ type: "image", props: { url: `${blob}/media/nested/960.webp` } }],
        },
        { type: "image", props: { url: "https://example.com/pic.png" } },
        { type: "image", props: {} },
        null,
        "junk",
      ]),
    ).toEqual(["nested"]);
  });
});

describe("plainText", () => {
  it("joins heading and paragraph text with spaces", () => {
    expect(
      plainText([
        { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Hello", styles: {} }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "brave ", styles: {} },
            { type: "link", href: "https://a.b", content: [{ type: "text", text: "new", styles: {} }] },
          ],
        },
        { type: "paragraph", content: "world" },
      ]),
    ).toBe("Hello brave new world");
  });

  it("includes children, callouts and table cells; skips empty blocks", () => {
    expect(
      plainText([
        { type: "callout", content: "Tip", children: [{ type: "paragraph", content: "inner" }] },
        { type: "image", props: { url: "x" } },
        {
          type: "table",
          content: { type: "tableContent", rows: [{ cells: [["a"], [{ type: "tableCell", content: ["b"] }]] }] },
        },
      ]),
    ).toBe("Tip inner a b");
  });
});

describe("withMediaAlt", () => {
  type B = { type: string; props?: Record<string, unknown>; content?: string; children?: B[] };
  const blocks: B[] = [
    { type: "image", props: { url: `${blob}/media/abc/960.webp`, name: "IMG_0042.jpg", caption: "Lunch" } },
    {
      type: "paragraph",
      content: "x",
      children: [{ type: "image", props: { url: "/uploads/media/def/480.webp", name: "IMG_7.jpg" } }],
    },
    { type: "image", props: { url: "https://example.com/elsewhere.png", name: "outside.png" } },
  ];

  it("uses the library alt text for every image it knows, nested ones too, without touching the input", () => {
    const out = withMediaAlt(blocks, new Map([["abc", "A carnitas burrito"], ["def", ""]])) as B[];
    expect(out[0]?.props).toEqual({ url: `${blob}/media/abc/960.webp`, name: "A carnitas burrito", caption: "Lunch" });
    // An empty library alt means "decorative": never the camera filename.
    expect(out[1]?.children?.[0]?.props?.name).toBe("");
    // Images that aren't in the library keep what the editor stored.
    expect(out[2]?.props?.name).toBe("outside.png");
    expect(blocks[0]?.props?.name).toBe("IMG_0042.jpg");
  });

  it("ends up as the img alt in the rendered html", async () => {
    const html = await renderPostHtml(withMediaAlt(blocks.slice(0, 1), new Map([["abc", "A \"big\" burrito"]])));
    expect(html).toContain('alt="A &quot;big&quot; burrito"');
    expect(html).not.toContain("IMG_0042");
  });
});
