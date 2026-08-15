"use client";

import { useActionState, useState } from "react";
import type { ActionResult, PickerItem } from "@/lib/actions";
import { ItemPicker } from "./item-picker";

type Item = PickerItem;
type Node = { id: string; code: string; segment: string; name: string; parent_id: string | null };
type Partner = { id: string; code: string; name: string };
type Location = { id: string; code: string; name: string };
type Line = { key: number; itemId: string; qty: string; unitCost: string };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Stock arriving with no purchase order behind it — goods that showed up,
 * or a PO placed outside this system. Posts real inventory now, at whatever
 * cost is entered; the supplier's bill is a separate document, whenever it
 * arrives.
 */
export function ReceiptForm({
  action,
  suppliers,
  items: initialItems,
  locations,
  today,
  categories,
  uoms,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  suppliers: Partner[];
  items: Item[];
  locations: Location[];
  today: string;
  categories: Node[];
  uoms: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never,
    null
  );

  const [items, setItems] = useState<Item[]>(initialItems);
  const addItem = (i: Item) => setItems((xs) => [...xs, i]);

  const [lines, setLines] = useState<Line[]>([{ key: 1, itemId: "", qty: "", unitCost: "" }]);
  const [partnerId, setPartnerId] = useState("");
  const [docDate, setDocDate] = useState(today);

  const byId = (id: string) => items.find((i) => i.id === id);

  function setLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function pickItem(key: number, itemId: string) {
    const item = byId(itemId);
    const cost = item ? Number(item.avg_cost) : 0;
    setLine(key, { itemId, unitCost: cost > 0 ? String(cost) : "" });
  }

  const addLine = () =>
    setLines((ls) => [...ls, { key: Math.max(0, ...ls.map((l) => l.key)) + 1, itemId: "", qty: "", unitCost: "" }]);

  const removeLine = (key: number) =>
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  const amount = (l: Line) => (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
  const total = lines.reduce((s, l) => s + amount(l), 0);

  const payload = JSON.stringify(
    lines
      .filter((l) => l.itemId && Number(l.qty) > 0)
      .map((l) => ({ itemId: l.itemId, qty: Number(l.qty), unitCost: Number(l.unitCost) || 0 }))
  );

  return (
    <form action={formAction} className="form wide">
      {state && "error" in state && <div className="alert">{state.error}</div>}

      <input type="hidden" name="lines" value={payload} />

      <div className="card">
        <div className="card-head">
          <h2>Supplier and warehouse</h2>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="field">
              <label htmlFor="partner_id">Supplier</label>
              <select id="partner_id" name="partner_id" value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)} required>
                <option value="">Choose…</option>
                {suppliers.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="location_id">Warehouse</label>
              <select id="location_id" name="location_id" defaultValue={locations[0]?.id ?? ""} required>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} · {l.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="doc_date">Received date</label>
              <input id="doc_date" name="doc_date" type="date" value={docDate}
                onChange={(e) => setDocDate(e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="reference">Reference</label>
              <input id="reference" name="reference" type="text" placeholder="Delivery note no." />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Lines</h2>
          <button type="button" className="ghost tiny" onClick={addLine}>Add line</button>
        </div>

        <div className="tablewrap">
          <table className="linetable">
            <thead>
              <tr>
                <th>Item</th><th className="r">Qty</th><th className="r">Unit cost</th>
                <th className="r">Value</th><th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const item = byId(l.itemId);
                return (
                  <tr key={l.key}>
                    <td style={{ minWidth: 240 }}>
                      <ItemPicker
                        mode="purchase"
                        items={items}
                        categories={categories}
                        uoms={uoms}
                        value={l.itemId}
                        onPick={(id) => pickItem(l.key, id)}
                        onCreated={addItem}
                      />
                    </td>
                    <td className="narrow">
                      <input type="number" min="0" step="any" value={l.qty}
                        onChange={(e) => setLine(l.key, { qty: e.target.value })}
                        aria-label="Quantity" />
                    </td>
                    <td className="narrow">
                      <input type="number" min="0" step="any" value={l.unitCost}
                        onChange={(e) => setLine(l.key, { unitCost: e.target.value })}
                        aria-label="Unit cost" />
                    </td>
                    <td className="r">{fmt(amount(l))}</td>
                    <td className="tight">
                      <button type="button" className="ghost tiny" onClick={() => removeLine(l.key)}
                        aria-label="Remove line" disabled={lines.length === 1}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="totalbar">
          <span style={{ color: "var(--muted)" }}>Received value</span>
          <span className="big">{fmt(total)} MMK</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="memo">Note</label>
        <input id="memo" name="memo" type="text" placeholder="Optional — English or Myanmar" />
      </div>

      <div className="actions">
        <button type="submit" disabled={pending || total === 0}>
          {pending ? "Posting…" : "Post goods receipt"}
        </button>
        <span className="page-sub">
          Stock arrives now, at this cost — Dr Inventory / Cr GR/IR Clearing.
          Post the supplier&rsquo;s invoice separately whenever it arrives.
        </span>
      </div>
    </form>
  );
}
