import React, { useState } from "react";
import type { Go } from "../App.js";
import {
  claimAccount,
  getProject,
  getToken,
  login,
  setToken,
  setUserEmail,
} from "../api.js";

export function SignUp({ go, projectId }: { go: Go; projectId: string }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "signup"
          ? await claimAccount(email, password)
          : await login(email, password, getToken(), projectId);
      setToken(res.token);
      setUserEmail(res.user.email);
      const project = await getProject(projectId);
      go(project.paidAt ? { name: "overview", projectId } : { name: "pay", projectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const valid = email.includes("@") && password.length >= 6;

  return (
    <div className="screen centered">
      <div className="card">
        <div className="eyebrow">{mode === "signup" ? "Save your app" : "Log in"}</div>
        <h2>{mode === "signup" ? "It's almost real." : "Welcome back."}</h2>
        <p className="lead">
          {mode === "signup"
            ? "Your app plan is done. Create an account so it's saved and waiting for you — then we build."
            : "Log in and we'll bring your new app plan straight to life."}
        </p>

        <input
          className="text-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
        <input
          className="text-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && submit()}
          placeholder="Password (6+ characters)"
        />

        {error && <div className="error-text">{error}</div>}

        <button className="primary full" onClick={submit} disabled={busy || !valid}>
          {busy ? "One moment…" : mode === "signup" ? "Save my app" : "Log in"}
        </button>

        <button
          className="link"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError(null);
          }}
        >
          {mode === "signup"
            ? "Already have an account? Log in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
