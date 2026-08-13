"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Counted = {
  id: string; code: string; name: string; name_my: string | null;
  parent_id: string | null; items: number;
};

type Mode =
  | { kind: "child"; parentId: string | null }   // add underneath
  | { kind: "above"; targetId: string }          // insert a new level on top
  | { kind: "move"; id: string };                // re-parent an existing branch

const LEVEL_NAMES = ["Parent category", "Category", "Sub category", "Level 4", "Level 5", "Level 6"];

function flatten(groups: Counted[], parentId: string | null = null, depth = 0): Array<Counted & { depth: number }> {
  return groups
    .filter((g) => g.parent_id === parentId)
    .flatMap((g) => [{ ...g, depth }, ...flatten(groups, g.id, depth + 1)]);
}

function pathOf(groups: Counted[], id: string): string {
  const parts: string[] = [];
  let cur: Counted | undefined = groups.find((g) => g.id === id);
  while (cur) {
    parts.unshift(cur.name);
    const pid: string | null = cur.parent_id;
    cur = pid ? groups.find((g) => g.id === pid) : undefined;
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

/** Every id inside a branch, so a move cannot target its own descendants. */
function branchOf(groups: Counted[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      if (g.parent_id && out.has(g.parent_id) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
    }
  }
  return out;
}

export function CategoryManager({
  groups, createAction, aboveAction, moveAction,
}: {
  groups: Counted[];
  createAction: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  aboveAction: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  moveAction: (prev: unknown, fd: FormData) => Promise<ActionResult>;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "child", parentId: null });

  const action =
    mode.kind === "child" ? createAction : mode.kind === "above" ? aboveAction : moveAction;

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never, null
  );

  const tree = flatten(groups);

  const activeId =
    mode.kind === "child" ? mode.parentId : mode.kind === "above" ? mode.targetId : mode.id;

  // Inserting above a category takes that category's own level; adding a
  // child goes one deeper than its parent.
  const newDepth =
    mode.kind === "child"
      ? depthOf(groups, mode.parentId)
      : mode.kind === "above"
        ? Math.max(0, depthOf(groups, mode.targetId) - 1)
        : 0;

  const levelName = LEVEL_NAMES[newDepth] ?? `Level ${newDepth + 1}`;

  const heading =
    mode.kind === "child" ? `New ${levelName.toLowerCase()}`
      : mode.kind === "above" ? "Insert a level above"
      : "Move category";

  return (
    <div className="grid2">
      <div className="card">
        <div className="card-head">
          <h2>Tree</h2>
          <span className="actions">
            <span className="page-sub">{tree.length} categor{tree.length === 1 ? "y" : "ies"}</span>
            <button type="button"
              className={mode.kind === "child" && mode.parentId === null ? "tiny" : "ghost tiny"}
              onClick={() => setMode({ kind: "child", parentId: null })}>
              + Parent category
            </button>
          </span>
        </div>

        {tree.length === 0 ? (
          <div className="empty">
            Nothing yet. Start with a parent category — the top of your product tree,
            such as Beverages or Household. You can always insert another level above
            it later.
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th className="r">Items</th><th>Change</th></tr>
              </thead>
              <tbody>
                {tree.map((g) => (
                  <tr key={g.id}
                      style={activeId === g.id ? { background: "var(--line-soft)" } : undefined}>
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
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="ghost tiny"
                        onClick={() => setMode({ kind: "above", targetId: g.id })}
                        title={`Insert a new category above ${g.name}`}>&uarr; above</button>{" "}
                      <button type="button" className="ghost tiny"
                        onClick={() => setMode({ kind: "child", parentId: g.id })}
                        title={`Add a category under ${g.name}`}>+ sub</button>{" "}
                      <button type="button" className="ghost tiny"
                        onClick={() => setMode({ kind: "move", id: g.id })}
                        title={`Move ${g.name} somewhere else`}>move</button>
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
          <h2>{heading}</h2>
          {mode.kind !== "child" && (
            <button type="button" className="ghost tiny"
              onClick={() => setMode({ kind: "child", parentId: null })}>Cancel</button>
          )}
        </div>
        <div className="card-body">
          <form action={formAction} className="form">
            {state && "error" in state && <div className="alert">{state.error}</div>}

            {mode.kind === "child" && <input type="hidden" name="parent_id" value={mode.parentId ?? ""} />}
            {mode.kind === "above" && <input type="hidden" name="target_id" value={mode.targetId} />}
            {mode.kind === "move" && <input type="hidden" name="id" value={mode.id} />}

            {mode.kind === "move" ? (
              <>
                <div className="field">
                  <label>Moving</label>
                  <div className="readout">{pathOf(groups, mode.id)}</div>
                  <span className="hint">Everything beneath it moves with it.</span>
                </div>
                <div className="field">
                  <label htmlFor="new_parent_id">Put it under</label>
                  <select id="new_parent_id" name="new_parent_id" defaultValue="">
                    <option value="">Nothing — make it a top-level parent</option>
                    {tree
                      .filter((g) => !branchOf(groups, mode.id).has(g.id))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {" ".repeat(g.depth * 2)}{g.depth > 0 ? "└ " : ""}{g.name} ({g.code})
                        </option>
                      ))}
                  </select>
                  <span className="hint">Its own branch is excluded — that would detach the tree.</span>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>{mode.kind === "above" ? "Will sit above" : "Goes under"}</label>
                  <div className="readout">
                    {mode.kind === "above"
                      ? pathOf(groups, mode.targetId)
                      : mode.parentId
                        ? pathOf(groups, mode.parentId)
                        : "Nothing — this is a top-level parent"}
                  </div>
                  <span className="hint">
                    {mode.kind === "above"
                      ? "That category, and everything under it, drops one level down."
                      : "Press ↑ above or + sub on any row to change this."}
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="code">Code</label>
                  <input id="code" name="code" type="text" required
                    placeholder={newDepth === 0 ? "FOOD" : newDepth === 1 ? "FOOD-BEV" : "FOOD-BEV-COLA"} />
                </div>

                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" type="text" required
                    placeholder={newDepth === 0 ? "Food & Drink" : newDepth === 1 ? "Beverages" : "Cola"} />
                </div>

                <div className="field">
                  <label htmlFor="name_my">Name (Burmese)</label>
                  <input id="name_my" name="name_my" type="text" />
                  <span className="hint">Optional. Unicode only</span>
                </div>
              </>
            )}

            <div className="actions">
              <button type="submit" disabled={pending}>
                {pending ? "Saving…"
                  : mode.kind === "above" ? "Insert above"
                  : mode.kind === "move" ? "Move category"
                  : `Save ${levelName.toLowerCase()}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
