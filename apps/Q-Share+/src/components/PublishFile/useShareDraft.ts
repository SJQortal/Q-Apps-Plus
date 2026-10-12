import { useCallback, useMemo, useReducer } from "react";
import type { FileRejection } from "react-dropzone";
import { titleFormatter } from "../../constants/Misc";
import { isQuillHtmlEmpty } from "../../utils/quillHtml";
import { addDraftFiles, describeAddResult, describeRejections, type DraftFile } from "./shareDraft";

export interface ShareDraftValues {
  files?: DraftFile[];
  title?: string;
  description?: string;
}

interface DraftState {
  files: DraftFile[];
  title: string;
  description: string;
  warnings: string[];
  problems: string[];
  attempted: boolean;
}

type DraftAction =
  | { type: "add-files"; accepted: File[]; rejectionWarnings: string[] }
  | { type: "remove-file"; key: string }
  | { type: "set-title"; title: string }
  | { type: "set-description"; html: string }
  | { type: "clear-warnings" }
  | { type: "reset"; values: ShareDraftValues }
  | { type: "validate"; hasCategory: boolean };

function initialState(values: ShareDraftValues = {}): DraftState {
  return {
    files: values.files ?? [],
    title: values.title ?? "",
    description: values.description ?? "",
    warnings: [],
    problems: [],
    attempted: false,
  };
}

/** The checks Publish runs; exported so the messages have one home. */
export function draftProblems(state: Pick<DraftState, "files" | "title" | "description">, hasCategory: boolean): string[] {
  const problems: string[] = [];
  if (state.files.length === 0) problems.push("Add at least one file.");
  if (!state.title.trim()) problems.push("Enter a title.");
  if (!hasCategory) problems.push("Choose a category.");
  if (isQuillHtmlEmpty(state.description)) problems.push("Enter a description.");
  return problems;
}

function reducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "add-files": {
      const result = addDraftFiles(state.files, action.accepted);
      return { ...state, files: result.files, warnings: [...action.rejectionWarnings, ...describeAddResult(result)] };
    }
    case "remove-file":
      return { ...state, files: state.files.filter((f) => f.key !== action.key) };
    case "set-title":
      return { ...state, title: action.title.replace(titleFormatter, "") };
    case "set-description":
      return { ...state, description: action.html };
    case "clear-warnings":
      return { ...state, warnings: [] };
    case "reset":
      return initialState(action.values);
    case "validate":
      return { ...state, problems: draftProblems(state, action.hasCategory), attempted: true };
    default:
      return state;
  }
}

export interface ShareDraft {
  files: DraftFile[];
  title: string;
  description: string;
  /** What the last drop did not add (duplicates, over the limit, too large). */
  warnings: string[];
  /** What stops the share from publishing, set by validate(). */
  problems: string[];
  /** True once Publish was pressed, so fields can show their error state. */
  attempted: boolean;
  /** Adds accepted files and explains rejected ones; returns true when one was too large. */
  addFiles: (accepted: File[], rejected?: FileRejection[]) => boolean;
  removeFile: (key: string) => void;
  setTitle: (title: string) => void;
  setDescription: (html: string) => void;
  clearWarnings: () => void;
  /** Fills in (or clears) the whole draft, e.g. after publishing. */
  reset: (values?: ShareDraftValues) => void;
  /** Records the problems and returns them; empty means the draft can publish. */
  validate: (hasCategory: boolean) => string[];
}

/**
 * The state behind the Share and Update dialogs; the form is a view of it.
 * Pass `initial` to start from a share being edited (remount with a `key`
 * to load a different one).
 */
export function useShareDraft(initial?: ShareDraftValues): ShareDraft {
  const [state, dispatch] = useReducer(reducer, initial, initialState);

  const addFiles = useCallback((accepted: File[], rejected: FileRejection[] = []) => {
    const rejection = describeRejections(rejected);
    dispatch({ type: "add-files", accepted, rejectionWarnings: rejection.warnings });
    return rejection.tooLarge;
  }, []);
  const removeFile = useCallback((key: string) => dispatch({ type: "remove-file", key }), []);
  const setTitle = useCallback((title: string) => dispatch({ type: "set-title", title }), []);
  const setDescription = useCallback((html: string) => dispatch({ type: "set-description", html }), []);
  const clearWarnings = useCallback(() => dispatch({ type: "clear-warnings" }), []);
  const reset = useCallback((values: ShareDraftValues = {}) => dispatch({ type: "reset", values }), []);
  const validate = useCallback(
    (hasCategory: boolean) => {
      dispatch({ type: "validate", hasCategory });
      return draftProblems(state, hasCategory);
    },
    [state]
  );

  return useMemo(
    () => ({ ...state, addFiles, removeFile, setTitle, setDescription, clearWarnings, reset, validate }),
    [state, addFiles, removeFile, setTitle, setDescription, clearWarnings, reset, validate]
  );
}
