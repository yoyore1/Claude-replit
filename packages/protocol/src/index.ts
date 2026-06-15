/**
 * Shared message protocol for the tap-to-edit system.
 *
 * Two "planes" travel between the IDE, the backend and the running preview app:
 *  - the **selection plane** (app <-> IDE): tap/selection events + edit-mode control
 *  - the **edit plane** (IDE -> backend): codemod edits applied to source files
 *
 * Every message has a `type` discriminant so consumers can switch exhaustively.
 */

/** A precise location in a source file, captured by the babel plugin at build time. */
export interface SourceLocation {
  /** Repo-relative POSIX path, e.g. "App.tsx" or "src/Home.tsx". */
  file: string;
  /** 1-based line of the JSX opening element. */
  line: number;
  /** 1-based column of the JSX opening element. */
  col: number;
  /** End of the JSX element (for disambiguation / future range edits). */
  end?: { line: number; col: number };
}

/** Deterministic id for a tagged element: `${file}:${line}:${col}`. */
export type ElementId = string;

export function makeElementId(loc: SourceLocation): ElementId {
  return `${loc.file}:${loc.line}:${loc.col}`;
}

export function parseElementId(id: ElementId): SourceLocation {
  const idx2 = id.lastIndexOf(":");
  const idx1 = id.lastIndexOf(":", idx2 - 1);
  return {
    file: id.slice(0, idx1),
    line: Number(id.slice(idx1 + 1, idx2)),
    col: Number(id.slice(idx2 + 1)),
  };
}

/** Style values we currently surface for editing (color first). */
export interface EditableStyle {
  color?: string;
  backgroundColor?: string;
  /** Anything else we read but do not yet edit. */
  [key: string]: string | number | undefined;
}

/** What the runtime knows about a tapped element. */
export interface Selection {
  elementId: ElementId;
  source: SourceLocation;
  /** Component/tag name, for the IDE label (e.g. "Text", "View"). */
  componentName: string;
  /** Current text content if this is a text-bearing element. */
  currentText?: string;
  /**
   * When the tapped text is supplied by a PROP of a component (e.g. a kit
   * <SettingsRow label="…"/>), this is the prop name to edit instead of a text
   * node. Set by the runtime via the `tapField` marker.
   */
  field?: string;
  /** Flattened, resolved style at tap time. */
  currentStyle: EditableStyle;
}

/* ----------------------------- app -> IDE ----------------------------------- */

export interface SelectionMessage {
  type: "selection";
  selection: Selection;
}

export interface HoverMessage {
  type: "hover";
  elementId: ElementId | null;
}

export interface AppReadyMessage {
  type: "app-ready";
  /** Whether the babel plugin tagged elements (tap-to-edit is available). */
  tagging: boolean;
}

export interface AckMessage {
  type: "ack";
  ok: boolean;
  detail?: string;
}

export type AppToIdeMessage =
  | SelectionMessage
  | HoverMessage
  | AppReadyMessage
  | AckMessage;

/* ----------------------------- IDE -> app ----------------------------------- */

export interface EnterEditModeMessage {
  type: "enter-edit-mode";
}

export interface ExitEditModeMessage {
  type: "exit-edit-mode";
}

/** Optimistic, cosmetic-only override applied to the live fiber before refresh. */
export interface ApplyOverrideMessage {
  type: "apply-override";
  elementId: ElementId;
  text?: string;
  style?: EditableStyle;
}

export interface ClearOverrideMessage {
  type: "clear-override";
  elementId: ElementId;
}

export type IdeToAppMessage =
  | EnterEditModeMessage
  | ExitEditModeMessage
  | ApplyOverrideMessage
  | ClearOverrideMessage;

/* -------------------------- edit plane (IDE -> backend) --------------------- */

export type EditKind = "text" | "color" | "backgroundColor" | "prop";

/** A request to mutate source code at a tagged location. */
export interface EditRequest {
  source: SourceLocation;
  kind: EditKind;
  /** New text (kind "text"/"prop") or new color string (color kinds). */
  value: string;
  /** Required for kind "prop": the JSX attribute name to set (e.g. "label"). */
  prop?: string;
  /**
   * For kind "color" on a kit component whose text is a tap-editable PROP
   * (e.g. "label", "value", "title", "largeTitle"): which sub-text to recolor.
   * The codemod scopes the color to a per-field style prop (`${field}Style`) so
   * a row's label and value recolor independently. Omitted for plain text/Views,
   * where the color applies to the element's own `style`.
   */
  field?: string;
}

export interface EditResult {
  ok: boolean;
  /** Human-readable reason on failure, e.g. "stale selection — re-tap". */
  error?: string;
  /** The file that was written, repo-relative. */
  file?: string;
}

/** Union of everything that can travel over the websocket hub. */
export type HubMessage = AppToIdeMessage | IdeToAppMessage;
