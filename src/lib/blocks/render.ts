import { ServerBlockNoteEditor } from "@blocknote/server-util";
import sanitizeHtml from "sanitize-html";
import { schema, type PartialPostBlock } from "./schema";

// Server-side post rendering (spec §7.2). Runs in a Node-runtime server action
// on every save; the result is stored in Post.html and served as-is.

function createEditor() {
  const ed = ServerBlockNoteEditor.create({ schema });
  // server-util's JSDOM has an opaque origin, so `window.localStorage` throws,
  // and BlockNote's toggle blocks read it while rendering. Giving the JSDOM a
  // URL turns localStorage into an ordinary in-memory store.
  const dom = (ed as unknown as { jsdom?: { reconfigure?(o: { url: string }): void } }).jsdom;
  dom?.reconfigure?.({ url: "http://localhost/" });
  return ed;
}

let editor: ReturnType<typeof createEditor> | null = null;
const getEditor = () => (editor ??= createEditor());

const LENGTH = /^-?(\d+(\.\d+)?|\.\d+)(em|ex|px|pt|%)?$/;
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,\s%]+\))$/i;
const KATEX_STYLES: Record<string, RegExp[]> = {
  height: [LENGTH],
  width: [LENGTH, /^calc\(100% - -?(\d+(\.\d+)?|\.\d+)em\)$/],
  "min-width": [LENGTH],
  top: [LENGTH],
  bottom: [LENGTH],
  left: [LENGTH],
  "vertical-align": [LENGTH],
  margin: [/^(-?(\d+(\.\d+)?|\.\d+)(em)?\s?){1,4}$/],
  "margin-left": [LENGTH],
  "margin-right": [LENGTH],
  "margin-top": [LENGTH],
  "padding-left": [LENGTH],
  "border-width": [LENGTH],
  "border-top-width": [LENGTH],
  "border-bottom-width": [LENGTH],
  "border-right-width": [LENGTH],
  "border-style": [/^(solid|dashed|dotted)$/],
  "border-right-style": [/^(solid|dashed|dotted)$/],
  "border-color": [COLOR],
  color: [COLOR],
  "background-color": [COLOR],
  position: [/^relative$/],
};

const MATHML_TAGS = [
  "math", "semantics", "annotation", "mrow", "mi", "mo", "mn", "ms", "mtext",
  "mspace", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mover",
  "munder", "munderover", "mtable", "mtr", "mtd", "mstyle", "mpadded",
  "mphantom", "menclose", "mglyph", "merror", "mlabeledtr", "mprescripts",
  "mmultiscripts", "none",
];
const MATHML_ATTRS = [
  "xmlns", "display", "encoding", "mathvariant", "mathcolor", "mathbackground",
  "mathsize", "stretchy", "fence", "separator", "lspace", "rspace", "largeop",
  "linebreak", "linethickness", "columnalign", "columnlines", "columnspacing",
  "rowlines", "rowspacing", "rowalign", "scriptlevel", "displaystyle", "accent",
  "accentunder", "width", "height", "depth", "voffset", "minsize", "maxsize",
  "movablelimits", "symmetric", "notation", "valign", "style",
];

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img", "figure", "figcaption", "pre", "code", "video", "audio", "input",
    "svg", "path", "line",
    ...MATHML_TAGS,
  ],
  allowedAttributes: {
    "*": ["class", "data-*", "aria-hidden", "aria-label"],
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "width", "height", "srcset", "sizes", "loading"],
    video: ["src", "controls", "width"],
    audio: ["src", "controls"],
    input: ["type", "checked", "disabled"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    span: ["style"],
    svg: ["xmlns", "width", "height", "viewBox", "preserveAspectRatio", "style"],
    path: ["d"],
    line: ["x1", "y1", "x2", "y2", "stroke-width"],
    ...Object.fromEntries(MATHML_TAGS.map((t) => [t, MATHML_ATTRS])),
  },
  allowedStyles: { "*": KATEX_STYLES },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https", "http"], video: ["https"], audio: ["https"] },
  allowProtocolRelative: false,
  // SVG attribute names (viewBox, preserveAspectRatio) are case-sensitive.
  parser: { lowerCaseAttributeNames: false },
  transformTags: {
    // BlockNote's check-list items: keep a read-only checkbox, nothing else.
    input: (_tag, attribs) => ({
      tagName: "input",
      attribs: {
        type: "checkbox",
        disabled: "",
        ...("checked" in attribs ? { checked: "" } : {}),
      },
    }),
  },
  // Editor-only chrome that has no meaning in a static page.
  exclusiveFilter: (frame) => {
    const cls = frame.attribs.class ?? "";
    return /\bbn-(resize-handle|toggle-button)\b/.test(cls);
  },
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE);
}

/** Blocks (BlockNote JSON) → sanitised HTML for `Post.html`. Node only. */
export async function renderPostHtml(blocks: unknown[]): Promise<string> {
  const raw = await getEditor().blocksToFullHTML(blocks as PartialPostBlock[]);
  return sanitizePostHtml(raw);
}

// ---------------------------------------------------------------------------
// Plain text (feeds readingMinutes). Works on partial JSON, never throws.

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null;

function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isObj(item)) return "";
      if (typeof item.text === "string") return item.text;
      return inlineText(item.content);
    })
    .join("");
}

function blockContentText(content: unknown): string {
  if (isObj(content) && content.type === "tableContent" && Array.isArray(content.rows)) {
    return content.rows
      .flatMap((row) => (isObj(row) && Array.isArray(row.cells) ? row.cells : []))
      .map((cell) => (isObj(cell) && "content" in cell ? inlineText(cell.content) : inlineText(cell)))
      .join(" ");
  }
  return inlineText(content);
}

function collect(blocks: unknown, out: string[]): void {
  if (!Array.isArray(blocks)) return;
  for (const block of blocks) {
    if (!isObj(block)) continue;
    out.push(blockContentText(block.content));
    collect(block.children, out);
  }
}

export function plainText(blocks: unknown[]): string {
  const parts: string[] = [];
  collect(blocks, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** The text of every top-level heading, in order (a template's outline). */
export function headingTexts(blocks: unknown[]): string[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is Json => isObj(b) && b.type === "heading")
    .map((b) => inlineText(b.content).trim())
    .filter(Boolean);
}
