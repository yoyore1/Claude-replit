import React, { useEffect, useState } from "react";
import { getDocs, type AppDocs, type Doc } from "../api.js";

type DocKey = "privacy" | "terms" | "support";

const TABS: { key: DocKey; label: string }[] = [
  { key: "privacy", label: "Privacy" },
  { key: "terms", label: "Terms" },
  { key: "support", label: "Support" },
];

/**
 * A modal that shows an app's tailored Privacy / Terms / Support documents,
 * fetched from the backend. Opened from the MyApps gallery and the Overview
 * "Included documents" cards so users can read what ships with their app.
 */
export function DocModal({
  projectId,
  initial = "privacy",
  onClose,
}: {
  projectId: string;
  initial?: DocKey;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<AppDocs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DocKey>(initial);

  useEffect(() => {
    let alive = true;
    getDocs(projectId)
      .then((d) => alive && setDocs(d))
      .catch((e: unknown) =>
        alive && setError(e instanceof Error ? e.message : "Could not load documents"),
      );
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doc: Doc | null = docs ? docs[tab] : null;

  return (
    <div className="doc-modal-backdrop" onClick={onClose}>
      <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-modal-head">
          <div className="doc-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`doc-tab ${tab === t.key ? "on" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="doc-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="doc-modal-body">
          {error && <div className="warn">{error}</div>}
          {!docs && !error && <p className="muted">Loading…</p>}
          {doc && (
            <>
              <h2 className="doc-title">{doc.title}</h2>
              {doc.sections.map((s, i) => (
                <div key={i} className="doc-section">
                  <h3>{s.heading}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
