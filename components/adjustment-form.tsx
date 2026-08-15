"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionResult, PickerItem } from "@/lib/actions";
import { ItemPicker } from "./item-picker";

type Item = PickerItem;
type Node = { id: string; code: string; segment: string; name: string; parent_id: string | null };
type Location = { id: string; code: string; name: string };
type Line = { key: number; itemId: string; qty: string; unitCost: string };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * A correction, not a transaction — damage, shrinkage, or a physical count
 * that disagrees with the ledger. Positive quantity is stock found;
 * negative is stock lost. No partner, because nobody sold or supplied this.
 */
export function AdjustmentForm({
  action,
  items: initialItems,
  locations,
  today,
  categories,
  uoms,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
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
  const [docDate, setDocDate] = useState(today);
  const [receivedTime, setReceivedTime] = useState("");

  useEffect(() => {
    setReceivedTime(new Date().toTimeString().slice(0, 5));
  }, []);

  const byId = (id: string) => items.find((i) => i.id === id);

  function setLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function pickItem(key: number, itemId: string) {
    const item = byId(itemId);
    const cost = item ? Number(item.next_cost) : 0;
    setLine(key, { itemId, unitCost: cost > 0 ? String(cost) : "" });
  }

  const addLine = () =>
    setLines((ls) => [...ls, { key: Math.max(0, ...ls.map((l) => l.key)) + 1, itemId: "", qty: "", unitCost: "" }]);

  const removeLine = (key: number) =>
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  const isLoss = (l: Line) => Number(l.qty) < 0;
  const effectiveCost = (l: Line) => {
    if (isLoss(l)) return Number(byId(l.itemId)?.next_cost ?? 0);
    return Number(l.unitCost) || 0;
  };
  const amount = (l: Line) => (Number(l.qty) || 0) * effectiveCost(l);
  const total = lines.reduce((s, l) => s + amount(l), 0);

  const payload = JSON.stringify(
    lines
      .filter((l) => l.itemId && Number(l.qty) !== 0)
      .map((l) => ({
        itemId: l.itemId,
        qty: Number(l.qty),
        unitCost: !isLoss(l) && l.unitCost !== "" ? Number(l.unitCost) : "",
      }))
  );

  // A loss can't take more than what's on hand.
  const shortages = lines.filter((l) => {
    if (!l.itemId || !isLoss(l)) return false;
    const item = byId(l.itemId);
    return item?.is_stocked && -Number(l.qty) > Number(item.on_hand);
  });

  return (
    <form action={formAction} className="form wide">
      {state && "error" in state && <div className="alert">{state.error}</div>}

      <input type="hidden" name="lines" value={payload} />

      <div className="card">
        <div className="card-head">
          <h2>Warehouse and date</h2>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="field">
              <label htmlFor="location_id">Warehouse</label>
              <select id="location_id" name="location_id" defaultValue={locations[0]?.id ?? ""} required>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} · {l.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="doc_date">Date</label>
              <input id="doc_date" name="doc_date" type="date" value={docDate}
                onChange={(e) => setDocDate(e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="received_time">Time</label>
              <input id="received_time" name="received_time" type="time" value={receivedTime}
                onChange={(e) => setReceivedTime(e.target.value)} />
              <span className="hint">For found stock — orders same-day entries correctly for FIFO</span>
            </div>

            <div className="field">
              <label htmlFor="reference">Reference</label>
              <input id="reference" name="reference" type="text" placeholder="Count sheet, incident no." />
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
                <th>Item</th><th className="r">On hand</th>
                <th className="r">Qty (+ found / − lost)</th><th className="r">Unit cost</th>
                <th className="r">Value</th><th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const item = byId(l.itemId);
                const loss = isLoss(l);
                const short = loss && item?.is_stocked && -Number(l.qty) > Number(item.on_hand);
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
                    <td className="r" style={{ color: short ? "var(--bad)" : undefined }}>
                      {item ? fmt(Number(item.on_hand)) : "—"}
                    </td>
                    <td className="narrow">
                      <input type="number" step="any" value={l.qty}
                        onChange={(e) => setLine(l.key, { qty: e.target.value })}
                        aria-label="Quantity" />
                    </td>
                    <td className="narrow">
                      {loss ? (
                        <span className="m" style={{ color: "var(--muted)" }}>
                          {fmt(effectiveCost(l))}
                        </span>
                      ) : (
                        <input type="number" min="0" step="any" value={l.unitCost}
                          onChange={(e) => setLine(l.key, { unitCost: e.target.value })}
                          aria-label="Unit cost" />
                      )}
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
          <span style={{ color: "var(--muted)" }}>Net value</span>
          <span className="big">{fmt(total)} MMK</span>
        </div>
      </div>

      {shortages.length > 0 && (
        <div className="alert">
          Not enough stock to remove for{" "}
          {shortages.map((l) => byId(l.itemId)?.code).join(", ")}. Posting will
          be rejected — reduce the loss quantity.
        </div>
      )}

      <div className="field">
        <label htmlFor="memo">Note</label>
        <input id="memo" name="memo" type="text" placeholder="What this correction is for — English or Myanmar" />
      </div>

      <div className="actions">
        <button type="submit" disabled={pending || lines.every((l) => !l.itemId || Number(l.qty) === 0) || shortages.length > 0}>
          {pending ? "Posting…" : "Post adjustment"}
        </button>
        <span className="page-sub">
          Posts straight to stock and the ledger — Dr/Cr Inventory against the Stock Adjustment account.
        </span>
      </div>
    </form>
  );
}
