import React, { useEffect, useState } from "react";
import type { Go } from "../App.js";
import { ensureSpec, getProject, type Project } from "../api.js";
import { DocModal } from "../components/DocModal.js";

type DocKey = "privacy" | "terms" | "support";

export function Overview({ go, projectId }: { go: Go; projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docTab, setDocTab] = useState<DocKey | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const p = await getProject(projectId);
        setProject(p);
        if (!p.spec) {
          const { spec } = await ensureSpec(projectId);
          setProject((prev) => (prev ? { ...prev, spec } : prev));
        }
      } catch (e: any) {
        setError(e.message);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const spec = project?.spec;
  const alreadyBuilt =
    project != null &&
    ["running", "sleeping", "building"].includes(project.status);

  return (
    <div className="screen overview">
      <nav className="nav">
        <span className="logo" onClick={() => go({ name: "apps" })}>
          Appable
        </span>
        <span className="step">Your app plan</span>
      </nav>

      <div className="overview-body">
        {error && <div className="warn">{error}</div>}
        <div className="eyebrow">Meet your app</div>
        <div className="overview-head">
          <div className="monogram">{(spec?.name ?? "A").trim()[0]}</div>
          <div>
            <h1>{spec?.name ?? "Your app"}</h1>
            {spec?.tagline && <p className="tagline">{spec.tagline}</p>}
          </div>
        </div>
        {spec?.description && <p className="desc">{spec.description}</p>}

        {spec?.screens && spec.screens.length > 0 && (
          <div className="screens-list">
            <div className="section-title">Screens</div>
            {spec.screens.map((sc) => (
              <div key={sc.name} className="screen-row">
                <b>{sc.name}</b>
                <span>{sc.purpose}</span>
              </div>
            ))}
          </div>
        )}

        {spec?.features && spec.features.length > 0 && (
          <div className="features">
            <div className="section-title">Features</div>
            <ul>
              {spec.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="section-title">Included documents</div>
        <div className="doc-cards">
          <button className="doc-card clickable" onClick={() => setDocTab("privacy")}>
            <b>Privacy policy ✓</b>
            <span>Written for {spec?.name ?? "your app"} — click to view</span>
          </button>
          <button className="doc-card clickable" onClick={() => setDocTab("terms")}>
            <b>Terms of service ✓</b>
            <span>Short and readable — click to view</span>
          </button>
          <button className="doc-card clickable" onClick={() => setDocTab("support")}>
            <b>Support page ✓</b>
            <span>Help for your users — click to view</span>
          </button>
        </div>

        <button
          className="primary full"
          disabled={!spec}
          onClick={() =>
            go({ name: "build", projectId, autostart: !alreadyBuilt })
          }
        >
          {alreadyBuilt ? "Open my app" : "Bring it to life ✨"}
        </button>
      </div>

      {docTab && (
        <DocModal
          projectId={projectId}
          initial={docTab}
          onClose={() => setDocTab(null)}
        />
      )}
    </div>
  );
}
