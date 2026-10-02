import { Suspense, lazy } from "react";
import { Skeleton } from "@mui/material";

// Quill is ~400 kB and only needed to write a description, so it loads when
// the Share or Update dialog first shows the editor.
const TextEditorQuill = lazy(() => import("./TextEditorQuill"));

export interface TextEditorProps {
  inlineContent: string;
  setInlineContent: (value: string) => void;
  placeholder?: string;
}

export const TextEditor = (props: TextEditorProps) => {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={184} sx={{ width: "100%" }} />}>
      <TextEditorQuill {...props} />
    </Suspense>
  );
};
