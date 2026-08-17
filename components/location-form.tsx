"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Location = { id: string; code: string; name: string; depth: number; is_stock_location: boolean };

// Regular spaces collapse in HTML — a non-breaking space is what actually
// survives to indent a native <option>, in every browser.
const NBSP = " ";

function parentOptionLabel(l: Location) {
  return `${NBSP.repeat(l.depth * 2)}${l.depth > 0 ? "└ " : ""}${l.code} · ${l.name}` +
    (l.is_stock_location ? " (warehouse)" : " (branch)");
}

export function AddLocationForm({
  action,
  locations,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  locations: Location[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never,
    null
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="actions">
        <button type="button" onClick={() => setOpen(true)}>+ Warehouse</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>New warehouse</h2>
        <span className="actions">
          <button type="button" className="ghost tiny" onClick={() => setOpen(false)}>Cancel</button>
        </span>
      </div>
      <div className="card-body">
        <form action={formAction} className="form">
          {state && "error" in state && <div className="alert">{state.error}</div>}

          <div className="row">
            <div className="field">
              <label htmlFor="code">Code</label>
              <input id="code" name="code" type="text" required autoFocus placeholder="MAIN-WH" />
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" required placeholder="Main Warehouse" />
            </div>
            <div className="field">
              <label htmlFor="name_my">Name (Burmese)</label>
              <input id="name_my" name="name_my" type="text" />
            </div>
            <div className="field">
              <label htmlFor="parent_id">Branch / parent</label>
              <select id="parent_id" name="parent_id" defaultValue="">
                <option value="">— none, top level —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{parentOptionLabel(l)}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="check" style={{ marginTop: "0.5rem" }}>
            <input name="is_stock_location" type="checkbox" defaultChecked />
            Holds stock — this is a real warehouse, not just an org unit
          </label>

          <div className="actions" style={{ marginTop: "0.75rem" }}>
            <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save warehouse"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
