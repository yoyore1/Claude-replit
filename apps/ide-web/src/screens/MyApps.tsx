import React, { useEffect, useState } from "react";
import type { Go } from "../App.js";
import {
  getUserEmail,
  listProjects,
  setToken,
  setUserEmail,
  type Project,
} from "../api.js";
import { DocModal } from "../components/DocModal.js";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  spec_ready: "Ready to build",
  building: "Building",
  running: "Live",
  sleeping: "Paused",
  error: "Needs attention",
};

/** Docs ship once an app is paid for or built. */
function hasDocs(p: Project): boolean {
  return (
    p.paidAt != null ||
    ["building", "running", "sleeping"].includes(p.status)
  );
}

export function MyApps({ go }: { go: Go }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docsFor, setDocsFor] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then((rows) => {
        setProjects(rows);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load your apps";
        setLoadError(message);
        setProjects([]);
      });
  }, []);

  function open(p: Project) {
    if (["running", "building", "sleeping", "error"].includes(p.status)) {
      go({ name: "build", projectId: p.id });
    } else if (p.status === "spec_ready") {
      go(p.paidAt ? { name: "overview", projectId: p.id } : { name: "pay", projectId: p.id });
    } else {
      go({ name: "interview", projectId: p.id });
    }
  }

  function logout() {
    setToken(null);
    setUserEmail(null);
    localStorage.removeItem("appable_route");
    go({ name: "home" });
  }

  return (
    <div className="screen myapps">
      <nav className="nav">
        <span className="logo" onClick={() => go({ name: "home" })}>
          Appable
        </span>
        <div className="row">
          <span className="muted small">{getUserEmail()}</span>
          <button className="btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>

      <div className="myapps-body">
        <div className="apps-title">Your apps</div>
        <div className="apps-sub">Pick up right where you left off.</div>

        <div className="app-grid">
          {/* New app tile — always first */}
          <button className="new-app-card" onClick={() => go({ name: "home" })}>
            New app
          </button>

          {/* Loading state */}
          {projects === null && !loadError && (
            <p className="muted">Loading your apps</p>
          )}

          {/* Error state */}
          {loadError && (
            <div className="app-card" style={{ cursor: "default" }}>
              <b>Could not reach Appable</b>
              <span className="muted small">{loadError}</span>
              <span className="muted small">
                Make sure the API is running on port 8787, then refresh this page.
              </span>
            </div>
          )}

          {/* App tiles */}
          {projects?.map((p) => (
            <button key={p.id} className="app-card" onClick={() => open(p)}>
              <b>{p.spec?.name ?? p.name}</b>
              <span className={`badge ${p.status}`}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
              <span className="muted small">
                Updated {new Date(p.updatedAt).toLocaleDateString()}
              </span>
              {hasDocs(p) && (
                <span
                  className="docs-line"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDocsFor(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      setDocsFor(p.id);
                    }
                  }}
                >
                  Privacy · Terms · Support ✓ — view
                </span>
              )}
            </button>
          ))}

          {/* Empty state */}
          {projects?.length === 0 && !loadError && (
            <p className="muted">No apps yet.</p>
          )}
        </div>
      </div>

      {docsFor && (
        <DocModal projectId={docsFor} onClose={() => setDocsFor(null)} />
      )}
    </div>
  );
}
