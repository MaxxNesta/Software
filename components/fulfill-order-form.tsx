"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Line = {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  remainingQty: number;
  expectedPrice?: number;
};

/**
 * One order as a card: collapsed shows just the header and a Deliver/Receive
 * button; expanded shows every open line with an editable quantity — and
 * cost, on the purchase side — defaulting to the full remainder, since
 * fulfilling in one go is the common case.
 */
export function FulfillOrderForm({
  kind,
  orderId,
  orderNo,
  partnerName,
  partnerId,
  locationId,
  lines,
  action,
}: {
  kind: "sales" | "purchase";
  orderId: string;
  orderNo: string;
  partnerName: string;
  partnerId: string;
  locationId: string;
  lines: Line[];
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action as never,
    null
  );
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.lineId, String(l.remainingQty)]))
  );
  const [cost, setCost] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.lineId, String(l.expectedPrice ?? 0)]))
  );

  const payload = JSON.stringify(
    lines
      .filter((l) => Number(qty[l.lineId]) > 0)
      .map((l) => ({
        itemId: l.itemId,
        qty: Number(qty[l.lineId]),
        unitCost: kind === "purchase" ? Number(cost[l.lineId]) || 0 : undefined,
        sourceLineId: l.lineId,
      }))
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <Link href={`/documents/${orderId}`} style={{ color: "var(--dr)" }}>{orderNo}</Link>
          {" · "}{partnerName}
        </h2>
        <span className="actions">
          <span className="page-sub">{lines.length} line{lines.length === 1 ? "" : "s"} open</span>
          <button type="button" className="ghost tiny" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : kind === "sales" ? "Deliver" : "Receive"}
          </button>
        </span>
      </div>

      {open && (
        <div className="card-body">
          <form action={formAction} className="form">
            {state && "error" in state && <div className="alert">{state.error}</div>}
            <input type="hidden" name="partner_id" value={partnerId} />
            <input type="hidden" name="location_id" value={locationId} />
            <input type="hidden" name="source_document_id" value={orderId} />
            <input type="hidden" name="doc_date" value={new Date().toISOString().slice(0, 10)} />
            <input type="hidden" name="reference" value={`Against ${orderNo}`} />
            <input type="hidden" name="lines" value={payload} />

            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th><th className="r">Remaining</th>
                    <th className="r">{kind === "sales" ? "Deliver now" : "Receive now"}</th>
                    {kind === "purchase" && <th className="r">Unit cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.lineId}>
                      <td className="wrap"><span className="code">{l.itemCode}</span> {l.itemName}</td>
                      <td className="r">{l.remainingQty}</td>
                      <td className="narrow">
                        <input
                          type="number" min="0" max={l.remainingQty} step="any"
                          value={qty[l.lineId]}
                          onChange={(e) => setQty((q) => ({ ...q, [l.lineId]: e.target.value }))}
                        />
                      </td>
                      {kind === "purchase" && (
                        <td className="narrow">
                          <input
                            type="number" min="0" step="any"
                            value={cost[l.lineId]}
                            onChange={(e) => setCost((c) => ({ ...c, [l.lineId]: e.target.value }))}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions" style={{ marginTop: "0.5rem" }}>
              <button type="submit" disabled={pending}>
                {pending ? "Posting…" : kind === "sales" ? "Post delivery" : "Post goods receipt"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
