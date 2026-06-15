import React from "react";
import { PREVIEW_URL } from "../config.js";

/**
 * The phone preview: an iframe pointing at the Expo web (Metro) dev server,
 * framed like a real iPhone (titanium body, Dynamic Island, 3D side buttons).
 * Tap-to-edit happens inside the iframe via the runtime; the edit toggle lives in
 * the toolbar above the phone (see Build.tsx).
 */
export function PreviewPane() {
  return (
    <div className="preview">
      <div className="phone">
        <div className="phone-device">
          {/* 3D side buttons */}
          <span className="phone-btn phone-btn-action" />
          <span className="phone-btn phone-btn-volup" />
          <span className="phone-btn phone-btn-voldown" />
          <span className="phone-btn phone-btn-power" />
          <div className="phone-bezel">
            <iframe className="phone-screen" src={PREVIEW_URL} title="preview" />
            <div className="phone-island" />
          </div>
        </div>
      </div>
    </div>
  );
}
