import React, { useState } from "react";
import type { FileNode } from "../api.js";

export function FileTree({
  nodes,
  activePath,
  onOpen,
}: {
  nodes: FileNode[];
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  return (
    <div className="tree">
      {nodes.map((n) => (
        <TreeNode
          key={n.path}
          node={n}
          depth={0}
          activePath={activePath}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  activePath,
  onOpen,
}: {
  node: FileNode;
  depth: number;
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: 8 + depth * 12 };

  if (node.type === "dir") {
    return (
      <div>
        <div className="tree-row dir" style={pad} onClick={() => setOpen(!open)}>
          <span className="caret">{open ? "▾" : "▸"}</span>
          {node.name}
        </div>
        {open &&
          node.children?.map((c) => (
            <TreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              activePath={activePath}
              onOpen={onOpen}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={"tree-row file" + (activePath === node.path ? " active" : "")}
      style={pad}
      onClick={() => onOpen(node.path)}
    >
      {node.name}
    </div>
  );
}
