import Link from "next/link";
import { Boxes, Receipt, Wallet, Banknote, AlertTriangle, Package } from "lucide-react";
import { money } from "@/lib/db";
import {
  getCompany, getKpis, getHealth, getAging, getDocuments, getStock, getActionItems,
  getRevenueTrend, getTopItems, getTopCustomers,
} from "@/lib/queries";
import { RevenueTrendChart, RankedBarChart } from "@/components/charts";
import { ActivityFeed, type ActivityDoc } from "@/components/activity-feed";

export default async function Dashboard() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found. Run <span className="m">npm run db:seed</span>.</div>;

  const [kpis, health, aging, docs, stock, actionItems, revenueTrend, topItems, topCustomers] = await Promise.all([
    getKpis(company.id),
    getHealth(company.id),
    getAging(company.id),
    getDocuments(company.id),
    getStock(company.id),
    getActionItems(company.id),
    getRevenueTrend(company.id),
    getTopItems(company.id),
    getTopCustomers(company.id),
  ]);

  const healthy = health.unbalanced === 0 && health.inventoryBreaks === 0 && health.trialBalance === 0;

  const actions = [
    {
      n: actionItems.salesOrdersOpen,
      label: `sales order${actionItems.salesOrdersOpen === 1 ? "" : "s"} waiting for delivery`,
      href: "/documents?type=SALES_ORDER",
      tone: "warn",
    },
    {
      n: actionItems.pendingDeliveryInvoices,
      label: `invoice${actionItems.pendingDeliveryInvoices === 1 ? "" : "s"} awaiting delivery`,
      href: "/documents?type=SALES_INVOICE",
      tone: "warn",
    },
    {
      n: Number(kpis.overdue.n),
      label: `invoice${Number(kpis.overdue.n) === 1 ? "" : "s"} overdue`,
      href: "/receivables",
      tone: "overdue",
    },
    {
      n: actionItems.purchaseOrdersOpen,
      label: `purchase order${actionItems.purchaseOrdersOpen === 1 ? "" : "s"} awaiting goods`,
      href: "/documents?type=PURCHASE_ORDER",
      tone: "warn",
    },
    {
      n: kpis.grirReceipts.n,
      label: `goods receipt${kpis.grirReceipts.n === 1 ? "" : "s"} waiting for a supplier invoice`,
      href: "/documents?type=GOODS_RECEIPT&open=grir",
      tone: "warn",
    },
    {
      n: kpis.grirInvoices.n,
      label: `supplier invoice${kpis.grirInvoices.n === 1 ? "" : "s"} waiting for the goods to arrive`,
      href: "/documents?type=PURCHASE_INVOICE&open=grir",
      tone: "warn",
    },
  ].filter((a) => a.n > 0);

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
          <span className="kpi-label"><Boxes size={13} /> Stock value</span>
          <span className="kpi-value">{money(kpis.stock.value)}</span>
          <span className="kpi-note">{money(kpis.stock.qty)} units on hand</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><Receipt size={13} /> Receivables</span>
          <span className="kpi-value">{money(kpis.ar.total)}</span>
          <span className="kpi-note">{kpis.ar.n} open invoice{kpis.ar.n === 1 ? "" : "s"}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><Wallet size={13} /> Payables</span>
          <span className="kpi-value">{money(kpis.ap.total)}</span>
          <span className="kpi-note">{kpis.ap.n} open bill{kpis.ap.n === 1 ? "" : "s"}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><Banknote size={13} /> Cash at bank</span>
          <span className="kpi-value">{money(kpis.cash.total)}</span>
          <span className="kpi-note">cash and KBZ</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><AlertTriangle size={13} /> Overdue</span>
          <span className="kpi-value" style={{ color: Number(kpis.overdue.total) > 0 ? "var(--bad)" : undefined }}>
            {money(kpis.overdue.total)}
          </span>
          <span className="kpi-note">{kpis.overdue.n} invoice{kpis.overdue.n === 1 ? "" : "s"} past due</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><Package size={13} /> Goods received, not invoiced</span>
          <span className="kpi-value">{money(Math.abs(kpis.grirReceipts.total))}</span>
          <span className="kpi-note">
            {kpis.grirReceipts.n} receipt{kpis.grirReceipts.n === 1 ? "" : "s"} awaiting a supplier invoice
          </span>
        </div>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Action required</h2>
            {actions.length > 0 && (
              <span className="page-sub">
                {actions.length} thing{actions.length === 1 ? "" : "s"} waiting on you
              </span>
            )}
          </div>
          <div className="card-body">
            {actions.length === 0 ? (
              <p className="page-sub">Nothing needs attention right now.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {actions.map((a) => (
                  <Link
                    key={a.href + a.label}
                    href={a.href}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--line)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span className={`pill ${a.tone}`}>{a.n}</span>
                      <span>{a.label}</span>
                    </span>
                    <span className="m" style={{ color: "var(--dr)" }}>View →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid2">
        <section>
          <div className="card">
            <div className="card-head">
              <h2>Revenue, last 6 months</h2>
            </div>
            <div className="card-body">
              <RevenueTrendChart data={revenueTrend as never} />
            </div>
          </div>
        </section>

        <section>
          <div className="card">
            <div className="card-head">
              <h2>Top-selling items</h2>
              <span className="page-sub">by revenue, last 6 months</span>
            </div>
            <div className="card-body">
              {topItems.length === 0 ? (
                <div className="empty">No sales invoices yet.</div>
              ) : (
                <RankedBarChart
                  data={(topItems as any[]).map((i) => ({ label: i.name, value: i.revenue }))}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Top customers</h2>
            <span className="page-sub">by revenue, last 6 months</span>
          </div>
          <div className="card-body">
            {topCustomers.length === 0 ? (
              <div className="empty">No sales invoices yet.</div>
            ) : (
              <RankedBarChart
                data={(topCustomers as any[]).map((c) => ({ label: c.name, value: c.revenue }))}
                height={Math.max(120, (topCustomers as any[]).length * 34)}
              />
            )}
          </div>
        </div>
      </section>

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
            <h2>Recent activity</h2>
            <Link href="/documents" className="m" style={{ color: "var(--dr)" }}>View all →</Link>
          </div>
          <div className="card-body">
            <ActivityFeed docs={docs.slice(0, 10) as unknown as ActivityDoc[]} />
          </div>
        </div>
      </section>
    </>
  );
}
