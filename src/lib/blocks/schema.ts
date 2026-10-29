import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  type BlockConfig,
} from "@blocknote/core";
import katex from "katex";

// The one BlockNote schema shared by the editor (Task 20) and the server
// renderer (render.ts). It is framework-free: no React, no Node APIs. Renderers
// use only `document`, which the browser or server-util's JSDOM provides at call
// time, so importing this module is safe anywhere.
//
// The configs below are the stored-JSON contract. An editor that wants richer
// React UI for these blocks builds it with `createReactBlockSpec(mathConfig, …)`
// / `createReactBlockSpec(calloutConfig, …)` in a separate client-only file, so
// documents stay interchangeable.

export const CALLOUT_VARIANTS = ["tip", "warning"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const mathConfig = {
  type: "math",
  propSchema: {
    latex: { default: "" },
  },
  content: "none",
} as const satisfies BlockConfig;

export const calloutConfig = {
  type: "callout",
  propSchema: {
    variant: { default: "tip", values: CALLOUT_VARIANTS },
  },
  content: "inline",
} as const satisfies BlockConfig;

/** KaTeX HTML for one display-mode formula. Never throws on bad LaTeX. */
export function renderLatex(latex: string): string {
  return katex.renderToString(latex, { displayMode: true, throwOnError: false });
}

export const mathBlock = createBlockSpec(mathConfig, {
  render: (block) => {
    const dom = document.createElement("div");
    dom.className = "math";
    dom.innerHTML = renderLatex(block.props.latex);
    return { dom };
  },
  parse: (el) =>
    el.classList.contains("math") ? { latex: el.dataset.latex ?? "" } : undefined,
});

export const calloutBlock = createBlockSpec(calloutConfig, {
  render: (block) => {
    const dom = document.createElement("aside");
    dom.className = `callout callout-${block.props.variant}`;
    // BlockNote adds its own classes to the content element, so keep it
    // separate from the aside: <aside class="callout …"><p class="bn-inline-content">.
    const contentDOM = document.createElement("p");
    dom.appendChild(contentDOM);
    return { dom, contentDOM };
  },
  parse: (el) => {
    if (el.tagName !== "ASIDE" || !el.classList.contains("callout")) return undefined;
    return { variant: el.classList.contains("callout-warning") ? "warning" : "tip" };
  },
});

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    math: mathBlock(),
    callout: calloutBlock(),
  },
});

export type PostSchema = typeof schema;
export type PostBlock = PostSchema["Block"];
export type PartialPostBlock = PostSchema["PartialBlock"];
