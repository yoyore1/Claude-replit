import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT, resolveInProject, toRel } from "./projectRoot.js";

export interface FileNode {
  name: string;
  path: string; // repo-relative
  type: "file" | "dir";
  children?: FileNode[];
}

const IGNORE = new Set([
  "node_modules",
  ".git",
  ".expo",
  "dist",
  "build",
  ".turbo",
  "web-build",
]);

/** Build a file tree of the project, skipping noisy/generated directories. */
export async function readTree(dir = PROJECT_ROOT): Promise<FileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".gitignore") continue;
    if (IGNORE.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      nodes.push({
        name: e.name,
        path: toRel(abs),
        type: "dir",
        children: await readTree(abs),
      });
    } else {
      nodes.push({ name: e.name, path: toRel(abs), type: "file" });
    }
  }
  nodes.sort((a, b) =>
    a.type !== b.type
      ? a.type === "dir"
        ? -1
        : 1
      : a.name.localeCompare(b.name),
  );
  return nodes;
}

export async function readFile(relPath: string): Promise<string> {
  return fs.readFile(resolveInProject(relPath), "utf8");
}

export async function writeFile(relPath: string, content: string): Promise<void> {
  const abs = resolveInProject(relPath);
  // Support multi-file generated apps (e.g. src/screens/Home.tsx).
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}
