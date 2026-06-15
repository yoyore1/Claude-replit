import React, { useEffect, useState } from "react";
import type { Go } from "../App.js";
import { ensureSpec, getProject, payProject, type Project } from "../api.js";

const PERKS = [
  "Your app, built and running in minutes",
  "Works on your real phone, not just a demo",
  "Change anything afterwards, just by asking",
  "Privacy policy, terms and support page included",
];

export function Pay({ go, projectId }: { go: Go; projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProject(projectId)
      .then((p) => {
        if (p.paidAt) go({ name: "overview", projectId });
        else setProject(p);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await payProject(projectId);
      void ensureSpec(projectId);
      go({ name: "overview", projectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed — try again");
      setBusy(false);
    }
  }

  const appName = project?.spec?.name ?? project?.name ?? "your app";

  return (
    <div className="screen centered">
      <div className="card pay">
        <div className="eyebrow">Start the build</div>
        <h2>Bring {appName} to life</h2>
        <p className="lead">
          One dollar. That's the whole build — and you get to watch it happen.
        </p>

        <div className="price-big">$1</div>
        <div className="small">one time</div>

        <ul className="perk-list">
          {PERKS.map((p) => (
            <li key={p}>
              <span className="perk-check">—</span>
              {p}
            </li>
          ))}
        </ul>

        {error && <div className="error-text">{error}</div>}

        <button className="primary full" onClick={pay} disabled={busy || !project}>
          {busy ? "Processing" : "Start the build · $1"}
        </button>

        <div className="trust-row">
          <span>Test mode — no card needed yet</span>
        </div>
      </div>
    </div>
  );
}
