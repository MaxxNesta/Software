import Link from "next/link";
import { money, shortDate } from "@/lib/db";
import { getCompany, getKpis, getHealth, getAging, getDocuments, getStock } from "@/lib/queries";

export default async function Dashboard() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found. Run <span className="m">npm run db:seed</span>.</div>;

  const [kpis, health, aging, docs, stock] = await Promise.all([
    getKpis(company.id),
    getHealth(company.id),
    getAging(company.id),
    getDocuments(company.id),
    getStock(company.id),
  ]);

  const healthy = health.unbalanced === 0 && health.inventoryBreaks === 0 && health.trialBalance === 0;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Dashboard</span>
        <h1>{company.name}</h1>
        <span className="page-sub">
          {company.name_my ? `${company.name_my} · ` : ""}Financial year 2026-27 · all figures in {company.base_currency}
        </span>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Stock value</span>
          <span className="kpi-value">{money(kpis.stock.value)}</span>
          <span className="kpi-note">{money(kpis.stock.qty)} units on hand</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Receivables</span>
          <span className="kpi-value">{money(kpis.ar.total)}</span>
          <span className="kpi-note">{kpis.ar.n} open invoice{kpis.ar.n === 1 ? "" : "s"}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Payables</span>
          <span className="kpi-value">{money(kpis.ap.total)}</span>
          <span className="kpi-note">{kpis.ap.n} open bill{kpis.ap.n === 1 ? "" : "s"}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Cash at bank</span>
          <span className="kpi-value">{money(kpis.cash.total)}</span>
          <span className="kpi-note">cash and KBZ</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Overdue</span>
          <span className="kpi-value" style={{ color: Number(kpis.overdue.total) > 0 ? "var(--bad)" : undefined }}>
            {money(kpis.overdue.total)}
          </span>
          <span className="kpi-note">{kpis.overdue.n} invoice{kpis.overdue.n === 1 ? "" : "s"} past due</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Goods not invoiced</span>
          <span className="kpi-value">{money(Math.abs(Number(kpis.grir.total)))}</span>
          <span className="kpi-note">{kpis.grir.n} supplier bill{kpis.grir.n === 1 ? "" : "s"} outstanding</span>
        </div>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Ledger health</h2>
            <span className={`pill ${healthy ? "ok" : "overdue"}`}>{healthy ? "All checks pass" : "Attention needed"}</span>
          </div>
          <div className="card-body">
            <div className="health">
              <span className="health-item">
                <span className={`dot ${health.trialBalance === 0 ? "ok" : "bad"}`} />
                Trial balance nets to {money(health.trialBalance)}
              </span>
              <span className="health-item">
                <span className={`dot ${health.unbalanced === 0 ? "ok" : "bad"}`} />
                {health.unbalanced} unbalanced entries
              </span>
              <span className="health-item">
                <span className={`dot ${health.inventoryBreaks === 0 ? "ok" : "bad"}`} />
                Inventory account agrees with the stock ledger
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid2">
        <section>
          <div className="card">
            <div className="card-head"><h2>Receivables aging</h2></div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Bucket</th><th className="r">Invoices</th><th className="r">Outstanding</th></tr>
                </thead>
                <tbody>
                  {aging.map((a: any) => (
                    <tr key={a.aging_bucket}>
                      <td>
                        <span className={`pill ${a.aging_bucket === "CURRENT" ? "ok" : "overdue"}`}>
                          {a.aging_bucket === "CURRENT" ? "Current" : `${a.aging_bucket} days`}
                        </span>
                      </td>
                      <td className="r">{a.invoices}</td>
                      <td className="r">{money(a.total)}</td>
                    </tr>
                  ))}
                  {aging.length === 0 && <tr><td colSpan={3} className="empty">Nothing outstanding</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="card">
            <div className="card-head"><h2>Stock on hand</h2></div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Item</th><th>Location</th><th className="r">Qty</th><th className="r">Value</th></tr>
                </thead>
                <tbody>
                  {stock.map((s: any, i: number) => (
                    <tr key={i}>
                      <td className="code">{s.item_code}</td>
                      <td className="code">{s.location_code}</td>
                      <td className="r">{money(s.qty_on_hand)}</td>
                      <td className="r">{money(s.value_on_hand)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="r">{money(kpis.stock.value)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Recent documents</h2>
            <Link href="/documents" className="m" style={{ color: "var(--dr)" }}>View all →</Link>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th><th>Type</th><th>Partner</th><th>Date</th>
                  <th>From</th><th className="r">Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.slice(0, 10).map((d: any) => (
                  <tr key={d.id} className="link">
                    <td className="code">
                      <Link href={`/documents/${d.id}`} style={{ color: "var(--dr)" }}>{d.doc_no ?? "—"}</Link>
                    </td>
                    <td className="m">{d.doc_type.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="wrap">{d.partner_name ?? "—"}</td>
                    <td className="code">{shortDate(d.posting_date)}</td>
                    <td className="code">{d.source_doc_no ?? "—"}</td>
                    <td className="r">{money(d.gross_total)}</td>
                    <td><span className={`pill ${d.status.toLowerCase()}`}>{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
