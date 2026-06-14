import React, { useEffect, useState } from "react";
import type { EditRequest, Selection } from "@cr/protocol";

/**
 * The tap-to-edit panel. When the user taps an element in the preview, this
 * shows its current text + colors and lets them change them. Each change is sent
 * as an EditRequest; the backend codemod rewrites the source and Metro refreshes.
 */
export function InlineEditor({
  selection,
  onApply,
  onAiEdit,
  onClose,
  status,
}: {
  selection: Selection | null;
  onApply: (req: EditRequest) => void;
  onAiEdit: (source: Selection["source"], instruction: string) => void;
  onClose: () => void;
  status?: string;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [instruction, setInstruction] = useState("");

  // Reseed when a different element is tapped.
  useEffect(() => {
    if (!selection) return;
    setText(selection.currentText ?? "");
    setColor(selection.currentStyle.color ?? "#000000");
    setBg(selection.currentStyle.backgroundColor ?? "#ffffff");
  }, [selection?.elementId]);

  if (!selection) {
    return (
      <div className="inspector empty">
        Tap an element in the preview to edit it.
      </div>
    );
  }

  const src = selection.source;

  return (
    <div className="inspector">
      <div className="inspector-head">
        <div>
          <div className="tag">{selection.componentName}</div>
          <div className="loc">
            {src.file}:{src.line}
          </div>
        </div>
        <button className="x" onClick={onClose}>
          ✕
        </button>
      </div>

      {selection.currentText !== undefined && (
        <label className="field">
          <span>Text</span>
          <div className="row">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  onApply({ source: src, kind: "text", value: text });
              }}
              placeholder="Type new text…"
            />
            <button
              onClick={() =>
                onApply({ source: src, kind: "text", value: text })
              }
            >
              Apply
            </button>
          </div>
        </label>
      )}

      <label className="field">
        <span>Text color</span>
        <div className="row">
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              onApply({ source: src, kind: "color", value: e.target.value });
            }}
          />
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                onApply({ source: src, kind: "color", value: color });
            }}
          />
        </div>
      </label>

      <label className="field">
        <span>Background</span>
        <div className="row">
          <input
            type="color"
            value={bg}
            onChange={(e) => {
              setBg(e.target.value);
              onApply({
                source: src,
                kind: "backgroundColor",
                value: e.target.value,
              });
            }}
          />
          <input
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                onApply({ source: src, kind: "backgroundColor", value: bg });
            }}
          />
        </div>
      </label>

      <label className="field">
        <span>Ask AI to change this</span>
        <div className="row">
          <input
            value={instruction}
            placeholder="e.g. make it bigger, move it up, round the corners"
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && instruction.trim()) {
                onAiEdit(src, instruction.trim());
                setInstruction("");
              }
            }}
          />
          <button
            onClick={() => {
              if (instruction.trim()) {
                onAiEdit(src, instruction.trim());
                setInstruction("");
              }
            }}
          >
            Ask
          </button>
        </div>
      </label>

      {status && <div className="status">{status}</div>}
    </div>
  );
}
