import React, { useEffect, useRef, useState } from "react";
import type { EditRequest, Selection } from "@cr/protocol";

const FONT_SAMPLE = "Hello";

// Fonts available on iOS (Expo Go) AND the web preview. The first group renders
// identically on both; the iOS-native ones (Palatino, Avenir, Menlo…) render on
// the phone and fall back gracefully in the browser preview.
const FONTS = [
  { label: "System", value: "System" },
  { label: "Georgia (serif)", value: "Georgia" },
  { label: "Times (serif)", value: "Times New Roman" },
  { label: "Palatino (serif)", value: "Palatino" },
  { label: "Helvetica", value: "Helvetica Neue" },
  { label: "Avenir", value: "Avenir Next" },
  { label: "Arial", value: "Arial" },
  { label: "Trebuchet", value: "Trebuchet MS" },
  { label: "Verdana", value: "Verdana" },
  { label: "Courier (mono)", value: "Courier New" },
  { label: "Menlo (mono)", value: "Menlo" },
];

/**
 * The tap-to-edit menu. When the user taps an element in the preview, this floats
 * beside the phone and lets them change its text, font, weight and colors. Colors,
 * font and weight apply live; text commits on "Apply change". Each change is an
 * EditRequest the backend codemod writes to source, then Metro refreshes.
 */
export function InlineEditor({
  selection,
  onApply,
  onClose,
  status,
}: {
  selection: Selection | null;
  onApply: (req: EditRequest) => void;
  onAiEdit?: (source: Selection["source"], instruction: string) => void;
  onClose: () => void;
  status?: string;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [font, setFont] = useState("System");
  const [weight, setWeight] = useState("normal");
  const [fontOpen, setFontOpen] = useState(false);
  const fontRef = useRef<HTMLDivElement>(null);

  // Reseed when a different element is tapped.
  useEffect(() => {
    if (!selection) return;
    setText(selection.currentText ?? "");
    setColor(selection.currentStyle.color ?? "#000000");
    setBg(selection.currentStyle.backgroundColor ?? "#ffffff");
    setFont(selection.currentStyle.fontFamily ?? "System");
    setWeight(selection.currentStyle.fontWeight ?? "normal");
    setFontOpen(false);
  }, [selection?.elementId]);

  // Close the font menu on outside click / Escape.
  useEffect(() => {
    if (!fontOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node))
        setFontOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFontOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [fontOpen]);

  if (!selection) return null;

  const src = selection.source;
  // A pure container/background has no text — show only the background color.
  const hasText = selection.currentText !== undefined || !!selection.field;
  const field = selection.field;

  const title =
    (selection.currentText && selection.currentText.trim()) ||
    selection.componentName;
  const shortTitle = title.length > 18 ? title.slice(0, 18) + "…" : title;

  const applyText = () =>
    onApply(
      field
        ? { source: src, kind: "prop", prop: field, value: text }
        : { source: src, kind: "text", value: text },
    );
  const applyStyle = (kind: EditRequest["kind"], value: string) =>
    onApply({ source: src, kind, value, field });

  return (
    <div className="inspector edit-card">
      <div className="edit-card-head">
        <span className="edit-card-title">{shortTitle}</span>
        <button className="edit-card-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>

      {selection.currentText !== undefined && (
        <label className="field">
          <span>Text</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyText()}
            placeholder="Type new text…"
          />
        </label>
      )}

      {hasText && (
        <>
          <label className="field">
            <span>Font</span>
            <div className="font-select-wrap" ref={fontRef}>
              <button
                type="button"
                className="font-select"
                onClick={() => setFontOpen((o) => !o)}
              >
                <span className="font-sample" style={{ fontFamily: font }}>
                  {FONT_SAMPLE}
                </span>
                <span className="font-current">
                  {FONTS.find((f) => f.value === font)?.label ?? font}
                </span>
                <span className="font-caret">⌄</span>
              </button>
              {fontOpen && (
                <div className="font-menu">
                  {FONTS.map((f) => (
                    <button
                      type="button"
                      key={f.value}
                      className={
                        "font-menu-item" + (f.value === font ? " on" : "")
                      }
                      onClick={() => {
                        setFont(f.value);
                        applyStyle("fontFamily", f.value);
                        setFontOpen(false);
                      }}
                    >
                      <span
                        className="font-sample"
                        style={{ fontFamily: f.value }}
                      >
                        {FONT_SAMPLE}
                      </span>
                      <span className="font-name">{f.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>

          <label className="field">
            <span>Weight</span>
            <div className="seg-toggle">
              {(["bold", "normal"] as const).map((w) => (
                <button
                  key={w}
                  className={weight === w ? "on" : ""}
                  onClick={() => {
                    setWeight(w);
                    applyStyle("fontWeight", w);
                  }}
                >
                  {w === "bold" ? "Bold" : "Normal"}
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span>Text color</span>
            <div className="swatch-row">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  applyStyle("color", e.target.value);
                }}
              />
              <input
                className="swatch-hex"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && applyStyle("color", color)
                }
              />
            </div>
          </label>
        </>
      )}

      <label className="field">
        <span>{hasText ? `${shortTitle} box background` : "Background"}</span>
        <div className="swatch-row">
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
            className="swatch-hex"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              onApply({ source: src, kind: "backgroundColor", value: bg })
            }
          />
        </div>
      </label>

      {selection.currentText !== undefined && (
        <button className="edit-apply" onClick={applyText}>
          Apply change
        </button>
      )}

      {status ? (
        <div className="status">{status}</div>
      ) : (
        <div className="edit-hint">
          Preview updates instantly. Wait for “Change saved.” before leaving.
        </div>
      )}
    </div>
  );
}
