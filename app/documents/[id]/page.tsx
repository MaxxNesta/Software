import Link from "next/link";
import { notFound } from "next/navigation";
import { money, qty, shortDate } from "@/lib/db";
import {
  getDocument,
  getDocumentLines,
  getJournalForDocument,
  getDownstream,
} from "@/lib/queries";

// The chain each document type sits in, so the detail page can show where
// this document falls and what comes next.
const CHAINS: Record<string, string[]> = {
  PURCHASE_ORDER:   ["PURCHASE_ORDER", "GOODS_RECEIPT", "PURCHASE_INVOICE", "SUPPLIER_PAYMENT"],
  GOODS_RECEIPT:    ["PURCHASE_ORDER", "GOODS_RECEIPT", "PURCHASE_INVOICE", "SUPPLIER_PAYMENT"],
  PURCHASE_INVOICE: ["PURCHASE_ORDER", "GOODS_RECEIPT", "PURCHASE_INVOICE", "SUPPLIER_PAYMENT"],
  SUPPLIER_PAYMENT: ["PURCHASE_ORDER", "GOODS_RECEIPT", "PURCHASE_INVOICE", "SUPPLIER_PAYMENT"],
  SALES_ORDER:      ["SALES_ORDER", "DELIVERY", "SALES_INVOICE", "CUSTOMER_RECEIPT"],
  DELIVERY:         ["SALES_ORDER", "DELIVERY", "SALES_INVOICE", "CUSTOMER_RECEIPT"],
  SALES_INVOICE:    ["SALES_ORDER", "DELIVERY", "SALES_INVOICE", "CUSTOMER_RECEIPT"],
  CUSTOMER_RECEIPT: ["SALES_ORDER", "DELIVERY", "SALES_INVOICE", "CUSTOMER_RECEIPT"],
};

const label = (t: string) => t.replace(/_/g, " ").toLowerCase();

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) notFound();

  const [lines, journal, downstream] = await Promise.all([
    getDocumentLines(id),
    getJournalForDocument(doc.journal_entry_id),
    getDownstream(id),
  ]);

  const chain = CHAINS[doc.doc_type] ?? [doc.doc_type];
  const totalDebit = journal.reduce((s: number, l: any) => s + Number(l.debit), 0);
  const totalCredit = journal.reduce((s: number, l: any) => s + Number(l.credit), 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{label(doc.doc_type)}</span>
        <h1>{doc.doc_no ?? "Draft"}</h1>
        <span className="page-sub">
          {doc.partner_name ?? "No partner"} · posted {shortDate(doc.posting_date)}
        </span>
      </div>

      <div className="flow">
        {chain.map((step, i) => (
          <span key={step} style={{ display: "contents" }}>
            {i > 0 && <span className="flow-arrow">→</span>}
            <span className={`flow-node ${step === doc.doc_type ? "here" : ""}`}>{label(step)}</span>
          </span>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head"><h2>Document</h2><span className={`pill ${doc.status.toLowerCase()}`}>{doc.status}</span></div>
          <div className="card-body">
            <dl className="kv">
              <dt>Number</dt><dd className="m">{doc.doc_no ?? "—"}</dd>
              <dt>Date</dt><dd>{shortDate(doc.doc_date)}</dd>
              <dt>Posting</dt><dd>{shortDate(doc.posting_date)}</dd>
              <dt>Due</dt><dd>{doc.due_date ? shortDate(doc.due_date) : "—"}</dd>
              <dt>Partner</dt><dd>{doc.partner_name ? `${doc.partner_code} · ${doc.partner_name}` : "—"}</dd>
              <dt>Location</dt><dd>{doc.location_code ? `${doc.location_code} · ${doc.location_name}` : "—"}</dd>
              <dt>Currency</dt><dd className="m">{doc.currency} @ {Number(doc.exchange_rate)}</dd>
              {doc.salesman_name && (
                <>
                  <dt>Salesman</dt>
                  <dd>{doc.salesman_code} · {doc.salesman_name}</dd>
                </>
              )}
              {doc.payment_type && (
                <>
                  <dt>Payment</dt>
                  <dd><span className="pill">{doc.payment_type}</span></dd>
                </>
              )}
              {doc.reference && (
                <>
                  <dt>Reference</dt>
                  <dd className="m">{doc.reference}</dd>
                </>
              )}
              {doc.to_deliver && (
                <>
                  <dt>Delivery</dt>
                  <dd>
                    <span className={`pill ${doc.delivered_at ? "ok" : "warn"}`}>
                      {doc.delivered_at ? "Delivered" : "To deliver"}
                    </span>
                  </dd>
                </>
              )}
              {doc.memo && (
                <>
                  <dt>Remark</dt>
                  <dd className="wrap">{doc.memo}</dd>
                </>
              )}
              <dt>Source</dt>
              <dd>
                {doc.source_doc_no
                  ? <Link href={`/documents/${doc.source_id}`} className="m" style={{ color: "var(--dr)" }}>{doc.source_doc_no}</Link>
                  : "—"}
              </dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Downstream</h2></div>
          {downstream.length > 0 ? (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Document</th><th>Type</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {downstream.map((d: any) => (
                    <tr key={d.id}>
                      <td className="code">
                        <Link href={`/documents/${d.id}`} style={{ color: "var(--dr)" }}>{d.doc_no}</Link>
                      </td>
                      <td className="m">{label(d.doc_type)}</td>
                      <td className="r">{money(d.gross_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Nothing has been created from this document yet</div>
          )}
        </div>
      </div>

      {lines.length > 0 && (
        <section>
          <div className="card">
            <div className="card-head"><h2>Lines</h2></div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Item</th><th>Description</th><th>Unit</th>
                    <th className="r">Qty</th><th className="r">Price</th><th className="r">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: any) => (
                    <tr key={l.id}>
                      <td className="code">{l.line_no}</td>
                      <td className="code">{l.item_code ?? "—"}</td>
                      <td className="wrap">
                        {l.item_name ?? l.description ?? "—"}
                        {l.foc_reason && <> <span className="pill warn">{l.foc_reason}</span></>}
                      </td>
                      <td className="code">{l.uom_code ?? "—"}</td>
                      <td className="r">{qty(l.entered_qty)}</td>
                      <td className="r">{money(l.unit_price)}</td>
                      <td className="r">{money(l.net_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>Total</td>
                    <td className="r">{money(doc.gross_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Posting</h2>
            <span className="m" style={{ color: "var(--muted)" }}>
              {doc.entry_no ? `Journal ${doc.entry_no}` : "This document type posts nothing"}
            </span>
          </div>
          {journal.length > 0 ? (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Account</th><th>Name</th>
                    <th className="r">Debit</th><th className="r">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.map((l: any) => (
                    <tr key={l.line_no}>
                      <td className="code">{l.line_no}</td>
                      <td className="code">{l.account_code}</td>
                      <td className="wrap">{l.account_name}</td>
                      <td className="r dr">{Number(l.debit) ? money(l.debit) : ""}</td>
                      <td className="r cr">{Number(l.credit) ? money(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      {totalDebit === totalCredit ? "Balanced" : "OUT OF BALANCE"}
                    </td>
                    <td className="r dr">{money(totalDebit)}</td>
                    <td className="r cr">{money(totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="empty">
              Orders commit nothing to the ledger — they exist to be fulfilled and reported against.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
