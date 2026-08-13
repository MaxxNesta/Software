"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Uom = { id: string; code: string; name: string };

/** Add a category at the level currently being viewed. */
export function AddCategoryForm({
  action,
  parentId,
  parentCode,
  returnTo,
  label,
  codeHint,
  nameHint,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  parentId: string | null;
  parentCode?: string;
  returnTo: string;
  label: string;
  codeHint: string;
  nameHint: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never,
    null
  );
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState("");

  const composed = `${parentCode ?? ""}${segment}`;

  if (!open) {
    return (
      <div className="actions">
        <button type="button" onClick={() => setOpen(true)}>+ {label}</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>New {label.toLowerCase()}</h2>
        <span className="actions">
          {segment && (
            <span className="m" style={{ color: "var(--dr)" }}>Code will be {composed}</span>
          )}
          <button type="button" className="ghost tiny" onClick={() => setOpen(false)}>Cancel</button>
        </span>
      </div>
      <div className="card-body">
        <form action={formAction} className="form">
          {state && "error" in state && <div className="alert">{state.error}</div>}
          <input type="hidden" name="parent_id" value={parentId ?? ""} />
          <input type="hidden" name="return_to" value={returnTo} />

          <div className="row">
            <div className="field">
              <label htmlFor="segment">Code segment</label>
              <input id="segment" name="segment" type="text" required autoFocus
                value={segment} onChange={(e) => setSegment(e.target.value)}
                placeholder={codeHint} />
              <span className="hint">
                {parentCode
                  ? `Added to ${parentCode} to make this category's code`
                  : "The start of every code beneath this category"}
              </span>
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" required placeholder={nameHint} />
            </div>
            <div className="field">
              <label htmlFor="name_my">Name (Burmese)</label>
              <input id="name_my" name="name_my" type="text" />
            </div>
          </div>

          <div className="actions">
            <button type="submit" disabled={pending}>{pending ? "Saving…" : `Save ${label.toLowerCase()}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
