import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { type DefaultReactSuggestionItem, getDefaultReactSlashMenuItems } from "@blocknote/react";
import type { PostEditorInstance } from "./react-blocks";

// The editor's "/" menu: exactly the eight items in spec §7, in this order.
// Built-in behaviour (the image upload panel, code blocks) comes from
// BlockNote's own items; Math and Callout are ours.

export const SLASH_MENU_TITLES = ["Heading", "Bulleted list", "Image", "Quote", "Code", "Math", "Callout", "Divider"] as const;

type Item = DefaultReactSuggestionItem;

const icon = (glyph: string) => (
  <span aria-hidden="true" className="post-slash-icon">
    {glyph}
  </span>
);

/** Focuses the LaTeX field of a math block once the editor has drawn it. */
function focusLatex(blockId: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>(`[data-id="${CSS.escape(blockId)}"] .post-math-input`)?.focus();
  });
}

export function postSlashMenuItems(editor: PostEditorInstance): Item[] {
  // BlockNote's items carry a `key` at runtime that its public type omits.
  const builtIn = new Map(
    (getDefaultReactSlashMenuItems(editor) as (Item & { key?: string })[]).map((item) => [item.key, item]),
  );
  const fromBuiltIn = (key: string, title: string, subtext: string, glyph: string, aliases: string[]): Item => {
    const item = builtIn.get(key);
    if (!item) throw new Error(`BlockNote has no "${key}" slash item`);
    return { title, subtext, aliases, group: "Blocks", icon: icon(glyph), onItemClick: item.onItemClick };
  };

  return [
    {
      title: "Heading",
      subtext: "Section title",
      aliases: ["h", "h2", "title", "section"],
      group: "Blocks",
      icon: icon("H"),
      // The post title is the page's h1, so body headings start at h2.
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "heading", props: { level: 2 } }),
    },
    fromBuiltIn("bullet_list", "Bulleted list", "Simple list", "•", ["ul", "list", "bullet"]),
    fromBuiltIn("image", "Image", "Upload or drag in a photo", "IMG", ["photo", "picture", "img"]),
    fromBuiltIn("quote", "Quote", "Pull quote", "“", ["blockquote", "pull"]),
    fromBuiltIn("code_block", "Code", "Syntax-highlighted block", "{}", ["code", "pre", "snippet"]),
    {
      title: "Math",
      subtext: "LaTeX equation",
      aliases: ["latex", "equation", "formula", "katex"],
      group: "Blocks",
      icon: icon("∑"),
      onItemClick: () => focusLatex(insertOrUpdateBlockForSlashMenu(editor, { type: "math", props: { latex: "" } }).id),
    },
    {
      title: "Callout",
      subtext: "Tip or warning box",
      aliases: ["tip", "warning", "note", "aside"],
      group: "Blocks",
      icon: icon("!"),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { variant: "tip" } }),
    },
    fromBuiltIn("divider", "Divider", "Horizontal rule", "—", ["hr", "rule", "line", "separator"]),
  ];
}
