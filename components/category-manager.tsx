"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Group = { id: string; code: string; name: string; name_my: string | null; parent_id: string | null };
type Counted = Group & { items: number };

const LEVEL_NAMES = ["Parent category", "Category", "Sub category", "Level 4", "Level 5"];

function flatten(groups: Counted[], parentId: string | null = null, depth = 0): Array<Counted & { depth: number }> {
  return groups
    .filter((g) => g.parent_id === parentId)
    .flatMap((g) => [{ ...g, depth }, ...flatten(groups, g.id, depth + 1)]);
}

function pathOf(groups: Counted[], id: string): string {
  const parts: string[] = [];
  let cur = groups.find((g) => g.id === id);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? groups.find((g) => g.id === cur!.parent_id) : undefined;
  }
  return parts.join(" → ");
}

function depthOf(groups: Counted[], id: string | null): number {
  let d = 0;
  let cur = id ? groups.find((g) => g.id === id) : null;
  while (cur?.parent_id) {
    d++;
    cur = groups.find((g) => g.id === cur!.parent_id) ?? null;
  }
  return id ? d + 1 : 0;
}

export function CategoryManager({
  groups,
  action,
}: {
  groups: Counted[];
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never,
    null
  );
  const [parentId, setParentId] = useState<string>("");

  const tree = flatten(groups);
  const newDepth = depthOf(groups, parentId || null);
  const levelName = LEVEL_NAMES[newDepth] ?? `Level ${newDepth + 1}`;

  return (
    <div className="grid2">
      <div className="card">
        <div className="card-head">
          <h2>Tree</h2>
          <span className="actions">
            <span className="page-sub">
              {tree.length} categor{tree.length === 1 ? "y" : "ies"}
            </span>
            <button
              type="button"
              className={parentId === "" ? "tiny" : "ghost tiny"}
              onClick={() => setParentId("")}
            >
              + Parent category
            </button>
          </span>
        </div>

        {tree.length === 0 ? (
          <div className="empty">
            Nothing yet. Start with a parent category — the top of your product tree,
            such as Beverages or Household.
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th className="r">Items</th><th /></tr>
              </thead>
              <tbody>
                {tree.map((g) => (
                  <tr key={g.id} className={parentId === g.id ? "link" : undefined}
                      style={parentId === g.id ? { background: "var(--line-soft)" } : undefined}>
                    <td className="code" style={{ paddingLeft: `${1 + g.depth * 1.4}rem` }}>
                      {g.depth > 0 && <span style={{ color: "var(--ghost)" }}>└ </span>}
                      {g.code}
                    </td>
                    <td className="wrap" style={{ fontWeight: g.depth === 0 ? 500 : 400 }}>
                      {g.name}
                      {g.name_my && (
                        <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{g.name_my}</div>
                      )}
                    </td>
                    <td className="r">{g.items || ""}</td>
                    <td className="tight">
                      <button type="button" className="ghost tiny"
                        onClick={() => setParentId(g.id)}
                        title={`Add a category under ${g.name}`}>
                        + sub
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>New {levelName.toLowerCase()}</h2>
          {parentId && (
            <button type="button" className="ghost tiny" onClick={() => setParentId("")}>
              Make it top level
            </button>
          )}
        </div>
        <div className="card-body">
          <form action={formAction} className="form">
            {state && "error" in state && <div className="alert">{state.error}</div>}

            <input type="hidden" name="parent_id" value={parentId} />

            <div className="field">
              <label>Goes under</label>
              <div style={{
                fontFamily: "var(--mono)", fontSize: "0.85rem",
                padding: "0.46rem 0.6rem", border: "1px solid var(--line)",
                borderRadius: "3px", background: "var(--ground)",
              }}>
                {parentId ? pathOf(groups, parentId) : "Nothing — this is a top-level parent"}
              </div>
              <span className="hint">
                {parentId
                  ? "Press + sub on any row to change this, or make it top level."
                  : "Press + sub on a row in the tree to nest it instead."}
              </span>
            </div>

            <div className="field">
              <label htmlFor="code">Code</label>
              <input id="code" name="code" type="text" required
                placeholder={newDepth === 0 ? "BEV" : newDepth === 1 ? "BEV-SOFT" : "BEV-SOFT-COLA"} />
            </div>

            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" required
                placeholder={newDepth === 0 ? "Beverages" : newDepth === 1 ? "Soft drinks" : "Cola"} />
            </div>

            <div className="field">
              <label htmlFor="name_my">Name (Burmese)</label>
              <input id="name_my" name="name_my" type="text" />
              <span className="hint">Optional. Unicode only</span>
            </div>

            <div className="actions">
              <button type="submit" disabled={pending}>
                {pending ? "Saving…" : `Save ${levelName.toLowerCase()}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
