"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Uom = { id: string; code: string; name: string };

/** Add a category at the level currently being viewed. */
export function AddCategoryForm({
  action,
  parentId,
  returnTo,
  label,
  codeHint,
  nameHint,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  parentId: string | null;
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
        <button type="button" className="ghost tiny" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <div className="card-body">
        <form action={formAction} className="form">
          {state && "error" in state && <div className="alert">{state.error}</div>}
          <input type="hidden" name="parent_id" value={parentId ?? ""} />
          <input type="hidden" name="return_to" value={returnTo} />

          <div className="row">
            <div className="field">
              <label htmlFor="code">Code</label>
              <input id="code" name="code" type="text" required autoFocus placeholder={codeHint} />
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

/** Add an item directly into the category being viewed. */
export function AddItemForm({
  action,
  groupId,
  groupPath,
  returnTo,
  uoms,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  groupId: string;
  groupPath: string;
  returnTo: string;
  uoms: Uom[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never,
    null
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="actions">
        <button type="button" onClick={() => setOpen(true)}>+ Item</button>
        <span className="page-sub">Goes straight into {groupPath}</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>New item in {groupPath}</h2>
        <button type="button" className="ghost tiny" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <div className="card-body">
        <form action={formAction} className="form">
          {state && "error" in state && <div className="alert">{state.error}</div>}
          <input type="hidden" name="item_group_id" value={groupId} />
          <input type="hidden" name="return_to" value={returnTo} />

          <div className="row">
            <div className="field">
              <label htmlFor="code">Code</label>
              <input id="code" name="code" type="text" required autoFocus placeholder="BEV-001" />
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" required placeholder="Cola 330ml Can" />
            </div>
            <div className="field">
              <label htmlFor="name_my">Name (Burmese)</label>
              <input id="name_my" name="name_my" type="text" />
            </div>
            <div className="field">
              <label htmlFor="base_uom_id">Base unit</label>
              <select id="base_uom_id" name="base_uom_id" required defaultValue={uoms[0]?.id ?? ""}>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
                ))}
              </select>
              <span className="hint">Stock is always stored in this unit</span>
            </div>
            <div className="field">
              <label htmlFor="sale_price">Sale price</label>
              <input id="sale_price" name="sale_price" type="number" min="0" step="any" />
              <span className="hint">Optional, in MMK</span>
            </div>
          </div>

          <label className="check" htmlFor="is_stocked" style={{ marginTop: "1rem" }}>
            <input id="is_stocked" name="is_stocked" type="checkbox" defaultChecked />
            Stocked — this item moves through inventory
          </label>

          <div className="actions">
            <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save item"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
