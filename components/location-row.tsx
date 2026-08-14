"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Location = {
  id: string; code: string; name: string; name_my: string | null;
  parent_id: string | null; parent_name: string | null;
  is_stock_location: boolean; is_active: boolean;
};

export function LocationRow({
  location,
  locations,
  updateAction,
  deleteAction,
  deactivateAction,
}: {
  location: Location;
  locations: Location[];
  updateAction: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  deleteAction: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  deactivateAction: (prev: unknown, fd: FormData) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateAction as never,
    null
  );
  const [, deactFormAction] = useActionState<ActionResult | null, FormData>(
    deactivateAction as never,
    null
  );
  const [delState, delFormAction, delPending] = useActionState<ActionResult | null, FormData>(
    deleteAction as never,
    null
  );

  const otherLocations = locations.filter((l) => l.id !== location.id);

  function confirmDelete(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`Delete ${location.name}? This can't be undone.`)) e.preventDefault();
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6}>
          <form action={formAction} className="form" style={{ padding: "0.5rem 0" }}>
            {state && "error" in state && <div className="alert">{state.error}</div>}
            <input type="hidden" name="id" value={location.id} />
            <div className="row">
              <div className="field">
                <label>Code</label>
                <input name="code" type="text" defaultValue={location.code} required />
              </div>
              <div className="field">
                <label>Name</label>
                <input name="name" type="text" defaultValue={location.name} required />
              </div>
              <div className="field">
                <label>Name (Burmese)</label>
                <input name="name_my" type="text" defaultValue={location.name_my ?? ""} />
              </div>
              <div className="field">
                <label>Branch / parent</label>
                <select name="parent_id" defaultValue={location.parent_id ?? ""}>
                  <option value="">— none, top level —</option>
                  {otherLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} · {l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="check" style={{ marginTop: "0.4rem" }}>
              <input name="is_stock_location" type="checkbox" defaultChecked={location.is_stock_location} />
              Holds stock
            </label>
            <label className="check" style={{ marginTop: "0.2rem" }}>
              <input name="is_active" type="checkbox" defaultChecked={location.is_active} />
              Active
            </label>
            <div className="actions" style={{ marginTop: "0.5rem" }}>
              <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
              <button type="button" className="ghost tiny" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="code">{location.code}</td>
      <td className="wrap">
        {location.name}
        {location.name_my && (
          <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{location.name_my}</div>
        )}
      </td>
      <td style={{ color: "var(--muted)" }}>{location.parent_name ?? "—"}</td>
      <td>{location.is_stock_location ? <span className="pill ok">warehouse</span> : <span className="pill">org unit</span>}</td>
      <td>{location.is_active ? <span className="pill ok">active</span> : <span className="pill warn">inactive</span>}</td>
      <td>
        <span className="actions">
          <button type="button" className="ghost tiny" onClick={() => setEditing(true)}>Edit</button>
          {location.is_active && (
            <form action={deactFormAction} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={location.id} />
              <button type="submit" className="ghost tiny">Deactivate</button>
            </form>
          )}
          <form action={delFormAction} onSubmit={confirmDelete} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={location.id} />
            <button type="submit" className="ghost tiny" disabled={delPending}>
              {delPending ? "Deleting…" : "Delete"}
            </button>
          </form>
        </span>
        {delState && "error" in delState && (
          <div className="hint" style={{ color: "var(--bad)" }}>{delState.error}</div>
        )}
      </td>
    </tr>
  );
}
