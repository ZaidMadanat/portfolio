"use client";

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useId, type Ref } from "react";
import { type CalloutVariant, calloutConfig, mathConfig, renderLatex } from "@/lib/blocks/schema";

// Editor-only React views for the custom blocks. They are built from the same
// configs as the shared schema (src/lib/blocks/schema.ts), so the stored JSON
// is identical and the server renders it with the vanilla specs. Only the
// editor UI differs: math gets an editable LaTeX field with a live preview, and
// a callout gets a button to switch between tip and warning.

type UpdateBlock = { updateBlock: (block: string, update: { props: Record<string, unknown> }) => unknown };

const CALLOUT_LABEL: Record<CalloutVariant, string> = { tip: "Tip", warning: "Heads up" };

function MathView({ block, editor }: { block: { id: string; props: { latex: string } }; editor: UpdateBlock }) {
  const id = useId();
  const { latex } = block.props;
  return (
    <div className="post-math">
      {latex.trim() ? (
        <div className="math" dangerouslySetInnerHTML={{ __html: renderLatex(latex) }} />
      ) : (
        <p className="post-math-empty">The formula shows here as you type.</p>
      )}
      <label htmlFor={id} className="post-math-label">
        LaTeX
      </label>
      <input
        id={id}
        className="post-math-input"
        value={latex}
        spellCheck={false}
        autoComplete="off"
        placeholder="z = \frac{x}{y}"
        onChange={(e) => editor.updateBlock(block.id, { props: { latex: e.target.value } })}
      />
    </div>
  );
}

function CalloutView({
  block,
  editor,
  contentRef,
}: {
  block: { id: string; props: { variant: CalloutVariant } };
  editor: UpdateBlock;
  contentRef: Ref<HTMLParagraphElement>;
}) {
  const { variant } = block.props;
  const next: CalloutVariant = variant === "tip" ? "warning" : "tip";
  return (
    <aside className={`callout callout-${variant}`}>
      <button
        type="button"
        contentEditable={false}
        className="callout-variant"
        aria-label={`${CALLOUT_LABEL[variant]} callout. Switch to ${CALLOUT_LABEL[next].toLowerCase()}`}
        onClick={() => editor.updateBlock(block.id, { props: { variant: next } })}
      >
        {CALLOUT_LABEL[variant]}
      </button>
      <p ref={contentRef} />
    </aside>
  );
}

const reactMathBlock = createReactBlockSpec(mathConfig, {
  render: (props) => <MathView block={props.block} editor={props.editor as unknown as UpdateBlock} />,
  parse: (el) => (el.classList.contains("math") ? { latex: el.dataset.latex ?? "" } : undefined),
});

const reactCalloutBlock = createReactBlockSpec(calloutConfig, {
  render: (props) => (
    <CalloutView block={props.block} editor={props.editor as unknown as UpdateBlock} contentRef={props.contentRef} />
  ),
  parse: (el) => {
    if (el.tagName !== "ASIDE" || !el.classList.contains("callout")) return undefined;
    const variant: CalloutVariant = el.classList.contains("callout-warning") ? "warning" : "tip";
    return { variant };
  },
});

/** The editor's schema: the shared one, with React views for math and callout. */
export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    math: reactMathBlock(),
    callout: reactCalloutBlock(),
  },
});

export type PostEditorInstance = typeof editorSchema.BlockNoteEditor;
