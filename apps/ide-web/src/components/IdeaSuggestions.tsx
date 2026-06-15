import React from "react";
import { ensureSession, suggestIdeas, type Idea, type IdeaSet } from "../api.js";

/**
 * The gold/silver idea panel on Home. The "gold" idea is the headline pick; the
 * two "silver" ideas are alternatives. Tapping "More like this" pushes a fresh
 * set onto a stack so the user can drill into a direction and step back.
 */

type Tier = "gold" | "silver";
interface IdeaView extends Idea {
  id: string;
  tier: Tier;
}
interface ViewSet {
  gold: IdeaView;
  silver: [IdeaView, IdeaView];
}

function uuid(): string {
  return (crypto as any).randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}`;
}

function toViewSet(raw: IdeaSet): ViewSet {
  return {
    gold: { ...raw.gold, id: uuid(), tier: "gold" },
    silver: [
      { ...raw.silver[0], id: uuid(), tier: "silver" },
      { ...raw.silver[1], id: uuid(), tier: "silver" },
    ],
  };
}

export async function fetchInitialSuggestions(seed?: string): Promise<ViewSet> {
  await ensureSession();
  const raw = await suggestIdeas(
    seed?.trim() ? { mode: "initial", seed: seed.trim() } : { mode: "random" },
  );
  return toViewSet(raw);
}

function IdeaCard({
  item,
  onUse,
  onSimilar,
}: {
  item: IdeaView;
  onUse: () => void;
  onSimilar: () => void;
}) {
  return (
    <div className={`idea-card ${item.tier}`}>
      <div className="idea-tier">{item.tier === "gold" ? "★ Top pick" : "Alternative"}</div>
      <div className="idea-title">{item.title}</div>
      <div className="idea-pitch">{item.pitch}</div>
      <div className="idea-actions">
        <button className="primary sm" onClick={onUse}>
          Use this
        </button>
        <button className="ghost sm" onClick={onSimilar}>
          More like this
        </button>
      </div>
    </div>
  );
}

export function IdeaSuggestionsPanel({
  seed,
  stack,
  stackIndex,
  onStackChange,
  onStackIndexChange,
  onUseIdea,
}: {
  seed: string;
  stack: ViewSet[];
  stackIndex: number;
  onStackChange: (s: ViewSet[]) => void;
  onStackIndexChange: (i: number) => void;
  onUseIdea: (text: string) => void;
}) {
  const current = stack[stackIndex];
  if (!current) return null;

  async function fetchSimilar(item: IdeaView) {
    await ensureSession();
    const raw = await suggestIdeas({
      mode: "similar",
      seed,
      basedOn: { title: item.title, pitch: item.pitch },
    });
    const next = toViewSet(raw);
    onStackChange([...stack.slice(0, stackIndex + 1), next]);
    onStackIndexChange(stackIndex + 1);
  }

  const use = (i: IdeaView) => onUseIdea(`${i.title}: ${i.pitch}`);

  return (
    <div className="ideas">
      {stackIndex > 0 && (
        <button className="ghost sm back" onClick={() => onStackIndexChange(stackIndex - 1)}>
          ← Back
        </button>
      )}
      <div className="idea-grid">
        <IdeaCard item={current.gold} onUse={() => use(current.gold)} onSimilar={() => fetchSimilar(current.gold)} />
        <IdeaCard item={current.silver[0]} onUse={() => use(current.silver[0])} onSimilar={() => fetchSimilar(current.silver[0])} />
        <IdeaCard item={current.silver[1]} onUse={() => use(current.silver[1])} onSimilar={() => fetchSimilar(current.silver[1])} />
      </div>
    </div>
  );
}

export type { ViewSet };
