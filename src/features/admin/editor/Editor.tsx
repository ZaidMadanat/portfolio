"use client";

import "@blocknote/mantine/style.css";
import "./editor.css";
import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useUpload } from "@/features/admin/useUpload";
import { editorSchema, type PostEditorInstance } from "./react-blocks";
import { postSlashMenuItems } from "./slash-menu";

// The BlockNote block editor (spec §7). Client-only: PostEditor loads it with
// next/dynamic and ssr:false, so BlockNote, Mantine and their CSS stay in this
// admin chunk. Images (slash menu, drag in, paste) go through the photo
// pipeline via useUpload, and its friendly errors show above the editor.

export type EditorApi = {
  getBlocks: () => unknown[];
  replaceBlocks: (blocks: unknown[]) => void;
};

type Props = {
  initialBlocks: unknown[];
  onChange: (blocks: unknown[]) => void;
  onReady: (api: EditorApi) => void;
};

type Blocks = PostEditorInstance["document"];

export default function Editor({ initialBlocks, onChange, onReady }: Props) {
  const { status, error, upload } = useUpload();
  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: initialBlocks.length > 0 ? (initialBlocks as Blocks) : undefined,
    animations: false,
    uploadFile: async (file: File) => {
      const media = await upload(file);
      if (!media) throw new Error("Upload failed");
      return media.url960;
    },
  });
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    onReady({
      getBlocks: () => editor.document,
      replaceBlocks: (blocks) => editor.replaceBlocks(editor.document, blocks as Blocks),
    });
  }, [editor, onReady]);

  return (
    <div className="post-editor">
      {/* KaTeX's stylesheet for the math previews; React hoists it into <head>. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/katex/katex.min.css" precedence="default" />
      <p role="status" className="text-sm font-semibold text-muted">
        {status === "uploading" ? "Uploading photo…" : ""}
      </p>
      {error ? (
        <p role="alert" className="mb-3 font-semibold text-accent-ink">
          {error}
        </p>
      ) : null}
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        slashMenu={false}
        onChange={() => onChange(editor.document)}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => filterSuggestionItems(postSlashMenuItems(editor), query)}
        />
      </BlockNoteView>
    </div>
  );
}
