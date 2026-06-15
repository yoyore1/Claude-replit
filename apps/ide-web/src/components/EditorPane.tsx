import React from "react";
import Editor from "@monaco-editor/react";

function languageFor(path: string | null): string {
  if (!path) return "plaintext";
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
}

export function EditorPane({
  path,
  value,
  onChange,
  onSave,
}: {
  path: string | null;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="editor" onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
    }}>
      {path ? (
        <Editor
          height="100%"
          theme="vs-dark"
          path={path}
          language={languageFor(path)}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
          }}
        />
      ) : (
        <div className="empty">Select a file to edit</div>
      )}
    </div>
  );
}
