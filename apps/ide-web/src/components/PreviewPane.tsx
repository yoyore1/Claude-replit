import React, { useRef } from "react";
import { PREVIEW_URL } from "../config.js";

/**
 * The phone preview: an iframe pointing at the Expo web (Metro) dev server,
 * framed like a device. Tap-to-edit happens inside the iframe via the runtime;
 * this component only frames it and offers a manual reload.
 */
export function PreviewPane({
  editMode,
  onToggleEditMode,
}: {
  editMode: boolean;
  onToggleEditMode: () => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="preview-title">Phone preview</span>
        <div className="preview-actions">
          <button
            className={"toggle" + (editMode ? " on" : "")}
            onClick={onToggleEditMode}
            title="Toggle tap-to-edit in the preview"
          >
            {editMode ? "✓ Tap to edit" : "Tap to edit"}
          </button>
          <button
            className="reload"
            onClick={() => {
              if (ref.current) ref.current.src = ref.current.src;
            }}
            title="Reload preview"
          >
            ⟳
          </button>
        </div>
      </div>
      <div className="phone">
        <iframe
          ref={ref}
          className="phone-screen"
          src={PREVIEW_URL}
          title="preview"
        />
      </div>
    </div>
  );
}
