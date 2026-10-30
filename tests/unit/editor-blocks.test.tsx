import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { editorSchema } from "@/features/admin/editor/react-blocks";
import { postSlashMenuItems, SLASH_MENU_TITLES } from "@/features/admin/editor/slash-menu";
import { calloutConfig, mathConfig, schema } from "@/lib/blocks/schema";

describe("editor schema", () => {
  it("stores exactly what the server renderer reads", () => {
    expect(editorSchema.blockSpecs.math.config).toEqual(mathConfig);
    expect(editorSchema.blockSpecs.callout.config).toEqual(calloutConfig);
    expect(Object.keys(editorSchema.blockSpecs).sort()).toEqual(Object.keys(schema.blockSpecs).sort());
  });
});

describe("slash menu", () => {
  it("has exactly the spec's eight items, in order", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema });
    const items = postSlashMenuItems(editor);
    expect(SLASH_MENU_TITLES).toEqual(["Heading", "Bulleted list", "Image", "Quote", "Code", "Math", "Callout", "Divider"]);
    expect(items.map((i) => i.title)).toEqual([...SLASH_MENU_TITLES]);
    expect(items.every((i) => typeof i.onItemClick === "function")).toBe(true);
  });
});
