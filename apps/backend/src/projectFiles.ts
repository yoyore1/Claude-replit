import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./store.js";
import { PROJECT_ROOT } from "./projectRoot.js";
import { readFile, writeFile } from "./fileApi.js";
import { reset as resetHistory } from "./history.js";

/**
 * Per-project source storage + "activation".
 *
 * Each project's generated app files live under `.data/projects/<id>/` mirroring
 * their repo-relative paths, plus a `manifest.json` listing them. Only ONE
 * project is "active" at a time: its files are copied into the live PROJECT_ROOT
 * (apps/template-app) so the single Metro dev server previews it. Switching
 * projects snapshots the current one back to its store first, so tap-to-edit
 * changes are never lost.
 */

const PROJECTS_DIR = path.join(DATA_DIR, "projects");

function projectDir(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId);
}

interface Manifest {
  files: string[];
}

async function readManifest(projectId: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(
      path.join(projectDir(projectId), "manifest.json"),
      "utf8",
    );
    const m = JSON.parse(raw);
    return Array.isArray(m.files) ? { files: m.files } : null;
  } catch {
    return null;
  }
}

async function writeManifest(projectId: string, m: Manifest): Promise<void> {
  await fs.mkdir(projectDir(projectId), { recursive: true });
  await fs.writeFile(
    path.join(projectDir(projectId), "manifest.json"),
    JSON.stringify(m, null, 2),
    "utf8",
  );
}

/** Which project's files currently occupy PROJECT_ROOT (null = unknown/none). */
let activeProjectId: string | null = null;

export function getActiveProjectId(): string | null {
  return activeProjectId;
}

/** Persist a built/edited file set into a project's store dir + manifest. */
export async function saveProjectFiles(
  projectId: string,
  files: Record<string, string>,
): Promise<void> {
  const dir = projectDir(projectId);
  const rels = Object.keys(files).filter((r) => typeof files[r] === "string");
  for (const rel of rels) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, files[rel], "utf8");
  }
  // Union with any previously-tracked files so partial saves don't lose paths.
  const prev = (await readManifest(projectId))?.files ?? [];
  const merged = [...new Set([...prev, ...rels])];
  await writeManifest(projectId, { files: merged });
}

/** Read a project's stored files back as a {rel: content} map. */
export async function loadProjectFiles(
  projectId: string,
): Promise<Record<string, string>> {
  const manifest = await readManifest(projectId);
  if (!manifest) return {};
  const out: Record<string, string> = {};
  for (const rel of manifest.files) {
    try {
      out[rel] = await fs.readFile(path.join(projectDir(projectId), rel), "utf8");
    } catch {
      /* skip missing */
    }
  }
  return out;
}

/** Copy the active project's current PROJECT_ROOT files back into its store. */
async function snapshotActive(): Promise<void> {
  if (!activeProjectId) return;
  const manifest = await readManifest(activeProjectId);
  if (!manifest) return;
  const files: Record<string, string> = {};
  for (const rel of manifest.files) {
    try {
      files[rel] = await readFile(rel); // reads from PROJECT_ROOT
    } catch {
      /* file may have been removed */
    }
  }
  if (Object.keys(files).length) await saveProjectFiles(activeProjectId, files);
}

/**
 * Make `projectId` the live preview: snapshot the previous active project, then
 * write this project's stored files into PROJECT_ROOT and reset the edit
 * timeline (the restored app is the new "initial" state). Returns the relative
 * paths written. No-op copy when the project has never been built.
 */
export async function activate(projectId: string): Promise<string[]> {
  if (activeProjectId === projectId) return [];
  await snapshotActive();
  const files = await loadProjectFiles(projectId);
  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(rel, content); // writes under PROJECT_ROOT
    written.push(rel);
  }
  activeProjectId = projectId;
  resetHistory();
  return written;
}

/**
 * Called by the builder after a successful generation: stash the files in the
 * project store and mark it active (the build already wrote them to PROJECT_ROOT).
 */
export async function seedFromBuild(
  projectId: string,
  files: Record<string, string>,
): Promise<void> {
  await saveProjectFiles(projectId, files);
  activeProjectId = projectId;
}
